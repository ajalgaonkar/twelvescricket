import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const CLUB_ID = 232;
const BASE_URL = "https://cricclubs.com";

async function scrapeScorecard(page: any, url: string): Promise<any | null> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await page.waitForSelector(".match-summary, .score-top", { timeout: 10000 });

    const liveData = await page.evaluate(() => {
      const result: any = {};

      const teamItems = document.querySelectorAll(".match-summary ul.list-inline li.win");
      if (teamItems.length >= 2) {
        result.team1Name = teamItems[0].querySelector(".teamName")?.textContent?.trim() || "";
        result.team1Score = teamItems[0].querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team1Overs = teamItems[0].querySelector("p")?.textContent?.trim() || "";
        result.team2Name = teamItems[1].querySelector(".teamName")?.textContent?.trim() || "";
        result.team2Score = teamItems[1].querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team2Overs = teamItems[1].querySelector("p")?.textContent?.trim() || "";
      }

      const h3s = document.querySelectorAll(".score-top .container h3");
      result.statusText = h3s[0]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";

      const status = result.statusText.toLowerCase();
      result.isLive =
        status.includes("runs needed") ||
        status.includes("wickets remaining") ||
        status.includes("overs remaining") ||
        status.includes("yet to bat");
      result.isCompleted =
        status.includes("won") ||
        status.includes("tied") ||
        status.includes("draw") ||
        status.includes("no result");

      result.battingNow = [];
      const tables = document.querySelectorAll("table");
      for (const table of tables) {
        const firstCell = table.querySelector("th, td");
        if (firstCell?.textContent?.trim() === "Batter") {
          const rows = table.querySelectorAll("tr");
          for (const row of rows) {
            const cells = row.querySelectorAll("th, td");
            if (cells.length >= 6) {
              const name = cells[0]?.textContent?.trim();
              if (name && name !== "Batter") {
                result.battingNow.push({
                  name,
                  runs: cells[1]?.textContent?.trim() || "0",
                  balls: cells[2]?.textContent?.trim() || "0",
                  fours: cells[3]?.textContent?.trim() || "0",
                  sixes: cells[4]?.textContent?.trim() || "0",
                  sr: cells[5]?.textContent?.trim() || "0",
                });
              }
            }
          }
          break;
        }
      }

      result.bowlingNow = [];
      for (const table of tables) {
        const firstCell = table.querySelector("th, td");
        if (firstCell?.textContent?.trim() === "Bowler") {
          const rows = table.querySelectorAll("tr");
          for (const row of rows) {
            const cells = row.querySelectorAll("th, td");
            if (cells.length >= 6) {
              const name = cells[0]?.textContent?.trim();
              if (name && name !== "Bowler") {
                result.bowlingNow.push({
                  name,
                  overs: cells[1]?.textContent?.trim() || "0",
                  maidens: cells[2]?.textContent?.trim() || "0",
                  runs: cells[3]?.textContent?.trim() || "0",
                  wickets: cells[4]?.textContent?.trim() || "0",
                  econ: cells[5]?.textContent?.trim() || "0",
                });
              }
            }
          }
          break;
        }
      }

      return result;
    });

    if (liveData.team1Score || liveData.team2Score) {
      return liveData;
    }
    return null;
  } catch (err) {
    console.log(`    Scorecard failed: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  // Clear old live scores
  await supabase.from("live_scores").delete().neq("match_id", "");
  console.log("Cleared old live scores.\n");

  const scrapedMatchIds = new Set<string>();

  // Strategy 1: Check club-level fixtures page for recent scorecard links (last 8 only)
  console.log("Strategy 1: Checking club fixtures page (most recent matches)...");
  try {
    const fixturesUrl = `${BASE_URL}/NWCL/listMatches.do?clubId=${CLUB_ID}`;
    await page.goto(fixturesUrl, { waitUntil: "networkidle2", timeout: 25000 });

    const allScorecardLinks = await page.evaluate(() => {
      const links: { matchId: string; href: string }[] = [];
      const anchors = document.querySelectorAll('a[href*="viewScorecard"]');
      for (const a of anchors) {
        const href = a.getAttribute("href") || "";
        const matchIdMatch = href.match(/matchId=(\d+)/);
        if (matchIdMatch) {
          links.push({ matchId: matchIdMatch[1], href });
        }
      }
      // Deduplicate and return the most recent 8 (highest match IDs = most recent)
      const seen = new Set<string>();
      const unique = links.filter((l) => {
        if (seen.has(l.matchId)) return false;
        seen.add(l.matchId);
        return true;
      });
      return unique.sort((a, b) => Number(b.matchId) - Number(a.matchId)).slice(0, 8);
    });

    console.log(`  Found ${allScorecardLinks.length} recent scorecard links`);

    for (const link of allScorecardLinks) {
      const url = `${BASE_URL}${link.href}`;
      console.log(`  Scraping match ${link.matchId}...`);

      const liveData = await scrapeScorecard(page, url);
      if (liveData) {
        const teamSlug = determineTeamSlug(liveData.team1Name, liveData.team2Name);
        if (!teamSlug) {
          console.log(`    Skipping (not a Twelves team match): ${liveData.team1Name} vs ${liveData.team2Name}`);
          continue;
        }
        const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
        console.log(`    ${liveData.team1Name} ${liveData.team1Score} (${liveData.team1Overs}) vs ${liveData.team2Name} ${liveData.team2Score} (${liveData.team2Overs})`);
        console.log(`    Status: ${statusLabel} - ${liveData.statusText}`);

        await saveToDb(link.matchId, teamSlug, liveData);
        scrapedMatchIds.add(link.matchId);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.log(`  Fixtures page failed: ${(err as Error).message}`);
  }

  await browser.close();
  console.log(`\nDone. Scraped ${scrapedMatchIds.size} matches total.`);
}

function determineTeamSlug(team1Name: string, team2Name: string): string | null {
  const combined = (team1Name + " " + team2Name).toLowerCase();
  if (combined.includes("copter")) return "copters";
  if (combined.includes("drone")) return "drones";
  if (combined.includes("jet")) return "jets";
  if (combined.includes("rocket")) return "rockets";
  return null;
}

async function saveToDb(matchId: string, teamSlug: string, liveData: any) {
  const { error } = await supabase.from("live_scores").upsert(
    {
      match_id: matchId,
      team_slug: teamSlug,
      team1_name: liveData.team1Name,
      team1_score: liveData.team1Score,
      team1_overs: liveData.team1Overs,
      team2_name: liveData.team2Name,
      team2_score: liveData.team2Score,
      team2_overs: liveData.team2Overs,
      status_text: liveData.statusText,
      is_live: liveData.isLive,
      batting_now: liveData.battingNow,
      bowling_now: liveData.bowlingNow,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "match_id" }
  );

  if (error) {
    console.log(`    DB error: ${error.message}`);
  } else {
    console.log(`    Saved to DB.`);
  }
}

main().catch(console.error);
