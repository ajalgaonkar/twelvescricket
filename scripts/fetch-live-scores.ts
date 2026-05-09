import puppeteer from "puppeteer";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const teams = [
  { slug: "copters", teamId: 1455, leagueId: 160, clubId: 232 },
  { slug: "drones", teamId: 1470, leagueId: 161, clubId: 232 },
  { slug: "jets", teamId: 1480, leagueId: 162, clubId: 232 },
  { slug: "rockets", teamId: 1494, leagueId: 163, clubId: 232 },
];

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

  // Strategy 1: Check club-level fixtures page for all scorecard links
  console.log("Strategy 1: Checking club fixtures page...");
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
      return links;
    });

    console.log(`  Found ${allScorecardLinks.length} scorecard links on fixtures page`);

    for (const link of allScorecardLinks) {
      const url = `${BASE_URL}${link.href}`;
      console.log(`  Scraping match ${link.matchId}...`);

      const liveData = await scrapeScorecard(page, url);
      if (liveData) {
        // Determine which team this belongs to
        const teamSlug = determineTeamSlug(liveData.team1Name, liveData.team2Name);
        const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
        console.log(`    ${liveData.team1Name} ${liveData.team1Score} (${liveData.team1Overs}) vs ${liveData.team2Name} ${liveData.team2Score} (${liveData.team2Overs})`);
        console.log(`    Status: ${statusLabel} - ${liveData.statusText}`);

        await saveToDb(link.matchId, teamSlug, liveData);
        scrapedMatchIds.add(link.matchId);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (err) {
    console.log(`  Fixtures page failed: ${(err as Error).message}`);
  }

  // Strategy 2: Check each team's schedule page
  console.log("\nStrategy 2: Checking team schedule pages...");
  for (const team of teams) {
    const scheduleUrl = `${BASE_URL}/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
    console.log(`  Checking ${team.slug}...`);

    try {
      await page.goto(scheduleUrl, { waitUntil: "networkidle2", timeout: 25000 });

      const matchLinks = await page.evaluate(() => {
        const links: { matchId: string; href: string }[] = [];
        const rows = document.querySelectorAll("#attTable tbody tr, #schedule-table1 tbody tr, table tbody tr");
        for (const row of rows) {
          const scorecardLink = row.querySelector('a[href*="viewScorecard"]');
          if (scorecardLink) {
            const href = scorecardLink.getAttribute("href") || "";
            const matchIdMatch = href.match(/matchId=(\d+)/);
            if (matchIdMatch) {
              links.push({ matchId: matchIdMatch[1], href });
            }
          }
        }
        return links.slice(-3);
      });

      console.log(`    Found ${matchLinks.length} matches with scorecards`);

      for (const ml of matchLinks) {
        if (scrapedMatchIds.has(ml.matchId)) {
          console.log(`    Skipping ${ml.matchId} (already scraped)`);
          continue;
        }

        const url = `${BASE_URL}${ml.href}`;
        console.log(`    Scraping match ${ml.matchId}...`);

        const liveData = await scrapeScorecard(page, url);
        if (liveData) {
          const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
          console.log(`      ${liveData.team1Name} ${liveData.team1Score} (${liveData.team1Overs}) vs ${liveData.team2Name} ${liveData.team2Score} (${liveData.team2Overs})`);
          console.log(`      Status: ${statusLabel} - ${liveData.statusText}`);

          await saveToDb(ml.matchId, team.slug, liveData);
          scrapedMatchIds.add(ml.matchId);
        }

        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.log(`    Failed: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  // Strategy 3: Try today's matches from the DB directly
  console.log("\nStrategy 3: Trying today's scheduled matches from DB...");
  try {
    const now = new Date();
    const todayStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;

    const { data: todayMatches } = await supabase
      .from("matches")
      .select("*")
      .eq("date", todayStr);

    if (todayMatches && todayMatches.length > 0) {
      console.log(`  Found ${todayMatches.length} matches scheduled for today (${todayStr})`);

      for (const match of todayMatches) {
        if (!match.match_id || scrapedMatchIds.has(match.match_id)) {
          continue;
        }

        // Try to find the CricClubs match ID by checking the scorecard URL
        // The DB match_id might be a date-based ID, so we need to try the schedule page
        // But we can also try common match ID patterns
        console.log(`  Match: ${match.team1} vs ${match.team2} (DB ID: ${match.match_id})`);
      }
    } else {
      console.log(`  No matches found for today (${todayStr})`);
    }
  } catch (err) {
    console.log(`  DB query failed: ${(err as Error).message}`);
  }

  // Strategy 4: Try known live scorecard URLs from recent range
  // CricClubs match IDs are sequential; try a range around recently known IDs
  console.log("\nStrategy 4: Probing recent match IDs...");
  const knownRecentId = 5426; // Known match ID from current season
  const probeRange = 5; // Check IDs around the known one

  for (let id = knownRecentId - probeRange; id <= knownRecentId + probeRange; id++) {
    if (scrapedMatchIds.has(String(id))) continue;

    const url = `${BASE_URL}/NWCL/viewScorecard.do?matchId=${id}&clubId=${CLUB_ID}`;
    console.log(`  Probing match ID ${id}...`);

    const liveData = await scrapeScorecard(page, url);
    if (liveData) {
      const teamSlug = determineTeamSlug(liveData.team1Name, liveData.team2Name);
      const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
      console.log(`    ${liveData.team1Name} ${liveData.team1Score} (${liveData.team1Overs}) vs ${liveData.team2Name} ${liveData.team2Score} (${liveData.team2Overs})`);
      console.log(`    Status: ${statusLabel} - ${liveData.statusText}`);

      await saveToDb(String(id), teamSlug, liveData);
      scrapedMatchIds.add(String(id));
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  await browser.close();
  console.log(`\nDone. Scraped ${scrapedMatchIds.size} matches total.`);
}

function determineTeamSlug(team1Name: string, team2Name: string): string {
  const combined = (team1Name + " " + team2Name).toLowerCase();
  if (combined.includes("copter")) return "copters";
  if (combined.includes("drone")) return "drones";
  if (combined.includes("jet")) return "jets";
  if (combined.includes("rocket")) return "rockets";
  return "unknown";
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
