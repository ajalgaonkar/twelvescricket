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

      // Find team items — filter out "VS" separators and empty items
      const allLis = document.querySelectorAll(".match-summary ul.list-inline li");
      const teamLis: Element[] = [];
      for (const li of allLis) {
        const text = li.textContent?.trim() || "";
        // Skip VS separators and empty items
        if (text.toUpperCase() === "VS" || text.toUpperCase() === "V" || text === "") continue;
        // Must have some team-related content (name or score)
        if (li.querySelector(".teamName") || li.querySelector("span") || text.length > 2) {
          teamLis.push(li);
        }
      }

      // Use li.win if we have 2 (both teams batted), otherwise use filtered list
      let t1: Element | null = null;
      let t2: Element | null = null;
      const winItems = document.querySelectorAll(".match-summary ul.list-inline li.win");
      if (winItems.length >= 2) {
        t1 = winItems[0];
        t2 = winItems[1];
      } else if (teamLis.length >= 2) {
        t1 = teamLis[0];
        t2 = teamLis[1];
      }

      result._debug = `winItems=${winItems.length}, teamLis=${teamLis.length}`;

      if (t1 && t2) {
        result.team1Name = t1.querySelector(".teamName")?.textContent?.trim()
          || t1.querySelector("a")?.textContent?.trim()
          || "";
        result.team1Score = t1.querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team1Overs = t1.querySelector("p")?.textContent?.trim() || "";

        result.team2Name = t2.querySelector(".teamName")?.textContent?.trim()
          || t2.querySelector("a")?.textContent?.trim()
          || "";
        result.team2Score = t2.querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team2Overs = t2.querySelector("p")?.textContent?.trim() || "";

        if (!result.team1Name) result._t1Html = t1.innerHTML.slice(0, 300);
        if (!result.team2Name) result._t2Html = t2.innerHTML.slice(0, 300);
      }

      const h3s = document.querySelectorAll(".score-top .container h3");
      result.statusText = h3s[0]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";

      const status = result.statusText.toLowerCase();
      result.isLive =
        status.includes("runs needed") ||
        status.includes("wickets remaining") ||
        status.includes("overs remaining") ||
        status.includes("yet to bat") ||
        status.includes("innings break") ||
        status.includes("in progress");
      result.isCompleted =
        status.includes("won") ||
        status.includes("tied") ||
        status.includes("draw") ||
        status.includes("no result");

      // Extract ALL batting and bowling performances from the full scorecard
      result.battingNow = [];
      result.bowlingNow = [];
      result.allBatting = [];
      result.allBowling = [];

      const tables = document.querySelectorAll("table");
      for (const table of tables) {
        const firstCell = table.querySelector("th, td");
        const header = firstCell?.textContent?.trim() || "";

        if (header === "Batter") {
          const rows = table.querySelectorAll("tr");
          for (const row of rows) {
            const cells = row.querySelectorAll("th, td");
            if (cells.length >= 6) {
              const name = cells[0]?.textContent?.trim();
              if (name && name !== "Batter") {
                const entry = {
                  name,
                  runs: cells[1]?.textContent?.trim() || "0",
                  balls: cells[2]?.textContent?.trim() || "0",
                  fours: cells[3]?.textContent?.trim() || "0",
                  sixes: cells[4]?.textContent?.trim() || "0",
                  sr: cells[5]?.textContent?.trim() || "0",
                };
                result.allBatting.push(entry);
                if (result.battingNow.length === 0) {
                  result.battingNow.push(entry);
                }
              }
            }
          }
          if (result.battingNow.length > 0 && result.battingNow.length === 1) {
            result.battingNow = [];
          }
        }

        if (header === "Bowler") {
          const rows = table.querySelectorAll("tr");
          for (const row of rows) {
            const cells = row.querySelectorAll("th, td");
            if (cells.length >= 6) {
              const name = cells[0]?.textContent?.trim();
              if (name && name !== "Bowler") {
                const entry = {
                  name,
                  overs: cells[1]?.textContent?.trim() || "0",
                  maidens: cells[2]?.textContent?.trim() || "0",
                  runs: cells[3]?.textContent?.trim() || "0",
                  wickets: cells[4]?.textContent?.trim() || "0",
                  econ: cells[5]?.textContent?.trim() || "0",
                };
                result.allBowling.push(entry);
                if (result.bowlingNow.length === 0) {
                  result.bowlingNow.push(entry);
                }
              }
            }
          }
          if (result.bowlingNow.length > 0 && result.bowlingNow.length === 1) {
            result.bowlingNow = [];
          }
        }
      }

      return result;
    });

    // Accept match if we found at least one team name
    if (liveData.team1Name || liveData.team2Name) {
      delete liveData._debug;
      delete liveData._t1Html;
      delete liveData._t2Html;
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

  // Remove entries older than 7 days (keep weekend results through the week)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("live_scores").delete().lt("updated_at", weekAgo);
  console.log("Removed entries older than 7 days.\n");

  const scrapedMatchIds = new Set<string>();

  // Check club-level fixtures page for recent scorecard links
  console.log("Checking club fixtures page (most recent matches)...");
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
      const seen = new Set<string>();
      const unique = links.filter((l) => {
        if (seen.has(l.matchId)) return false;
        seen.add(l.matchId);
        return true;
      });
      return unique.sort((a, b) => Number(b.matchId) - Number(a.matchId)).slice(0, 10);
    });

    console.log(`  Found ${allScorecardLinks.length} recent scorecard links`);

    for (const link of allScorecardLinks) {
      const url = `${BASE_URL}${link.href}`;
      console.log(`  Scraping match ${link.matchId}...`);

      let liveData = await scrapeScorecard(page, url);
      if (!liveData) {
        console.log(`    Retrying ${link.matchId}...`);
        liveData = await scrapeScorecard(page, url);
      }
      if (liveData) {
        const teamSlug = determineTeamSlug(liveData.team1Name, liveData.team2Name);
        if (!teamSlug) {
          console.log(`    Skipping (not a Twelves team match): ${liveData.team1Name} vs ${liveData.team2Name}`);
          continue;
        }
        const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
        console.log(`    ${liveData.team1Name} ${liveData.team1Score || "—"} (${liveData.team1Overs || ""}) vs ${liveData.team2Name} ${liveData.team2Score || "—"} (${liveData.team2Overs || ""})`);
        console.log(`    Status: ${statusLabel} - ${liveData.statusText || "(no status)"}`);

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
  if (combined.includes("twelves")) return "unknown-twelves";

  // If one team name is empty, check if the other is a scheduled opponent of Twelves
  // (this handles CricClubs DOM extraction issues where team name span is missing)
  const knownTwelvesOpponents = [
    "punjab kings", "bellevue chargers", "oregon cc", "wsu cougars",
    "bellingham daredevils", "spokane spartans", "bellevue smashers",
    "southside hawks", "wcc f-16", "vs sports challengers",
  ];
  if (!team1Name || !team2Name) {
    const known = (team1Name || team2Name).toLowerCase();
    if (knownTwelvesOpponents.some((o) => known.includes(o))) {
      return "unknown-twelves";
    }
  }

  return null;
}

async function saveToDb(matchId: string, teamSlug: string, liveData: any) {
  const { error } = await supabase.from("live_scores").upsert(
    {
      match_id: matchId,
      team_slug: teamSlug,
      team1_name: liveData.team1Name,
      team1_score: liveData.team1Score || "",
      team1_overs: liveData.team1Overs || "",
      team2_name: liveData.team2Name,
      team2_score: liveData.team2Score || "",
      team2_overs: liveData.team2Overs || "",
      status_text: liveData.statusText || "",
      is_live: liveData.isLive || false,
      batting_now: liveData.allBatting || liveData.battingNow || [],
      bowling_now: liveData.allBowling || liveData.bowlingNow || [],
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
