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

  // For each team, check their schedule page for live/recent matches
  for (const team of teams) {
    const scheduleUrl = `https://cricclubs.com/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
    console.log(`Checking schedule for ${team.slug}...`);

    try {
      await page.goto(scheduleUrl, { waitUntil: "networkidle2", timeout: 20000 });

      // Find matches with scorecard links (these have results or are live)
      const matchLinks = await page.evaluate(() => {
        const links: { matchId: string; url: string }[] = [];
        const rows = document.querySelectorAll("#attTable tbody tr");
        for (const row of rows) {
          const scorecardLink = row.querySelector('a[href*="viewScorecard"]');
          if (scorecardLink) {
            const href = scorecardLink.getAttribute("href") || "";
            const matchIdMatch = href.match(/matchId=(\d+)/);
            if (matchIdMatch) {
              links.push({
                matchId: matchIdMatch[1],
                url: `https://cricclubs.com${href}`,
              });
            }
          }
        }
        // Return the most recent matches (last few with scorecards)
        return links.slice(-3);
      });

      console.log(`  Found ${matchLinks.length} matches with scorecards`);

      for (const ml of matchLinks) {
        console.log(`  Fetching scorecard ${ml.matchId}...`);
        try {
          await page.goto(ml.url, { waitUntil: "networkidle2", timeout: 20000 });
          await page.waitForSelector(".match-summary", { timeout: 10000 });

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
              status.includes("overs remaining");

            result.isCompleted = status.includes("won") || status.includes("tied") || status.includes("draw") || status.includes("no result");

            // Current batters
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

            // Current bowlers
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
            const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
            console.log(`    ${liveData.team1Name} ${liveData.team1Score} (${liveData.team1Overs}) vs ${liveData.team2Name} ${liveData.team2Score} (${liveData.team2Overs})`);
            console.log(`    Status: ${statusLabel} - ${liveData.statusText}`);

            const { error } = await supabase.from("live_scores").upsert(
              {
                match_id: ml.matchId,
                team_slug: team.slug,
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
        } catch (err) {
          console.log(`    Failed: ${(err as Error).message}`);
        }

        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (err) {
      console.log(`  Failed to load schedule: ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch(console.error);
