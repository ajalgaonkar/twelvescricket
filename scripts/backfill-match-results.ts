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

const teams = [
  { slug: "copters", teamId: 1455, leagueId: 160, clubId: 232 },
  { slug: "drones", teamId: 1470, leagueId: 161, clubId: 232 },
  { slug: "jets", teamId: 1480, leagueId: 162, clubId: 232 },
  { slug: "rockets", teamId: 1494, leagueId: 163, clubId: 232 },
];

function determineTeamSlug(team1Name: string, team2Name: string): string | null {
  const combined = (team1Name + " " + team2Name).toLowerCase();
  if (combined.includes("copter")) return "copters";
  if (combined.includes("drone")) return "drones";
  if (combined.includes("jet")) return "jets";
  if (combined.includes("rocket")) return "rockets";
  if (combined.includes("twelves")) return "unknown-twelves";
  return null;
}

async function scrapeScorecard(page: any, url: string): Promise<any | null> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.waitForSelector(".match-summary, .score-top", { timeout: 10000 });

    const data = await page.evaluate(() => {
      const result: any = {};

      const allLis = document.querySelectorAll(".match-summary ul.list-inline li");
      const teamLis: Element[] = [];
      for (const li of allLis) {
        const text = li.textContent?.trim() || "";
        if (text.toUpperCase() === "VS" || text.toUpperCase() === "V" || text === "") continue;
        if (li.querySelector(".teamName") || li.querySelector("span") || text.length > 2) {
          teamLis.push(li);
        }
      }

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

      if (t1 && t2) {
        result.team1Name = t1.querySelector(".teamName")?.textContent?.trim()
          || t1.querySelector("a")?.textContent?.trim() || "";
        result.team1Score = t1.querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team1Overs = (t1.querySelector("p")?.textContent?.trim() || "").replace(/\s+/g, " ");

        result.team2Name = t2.querySelector(".teamName")?.textContent?.trim()
          || t2.querySelector("a")?.textContent?.trim() || "";
        result.team2Score = t2.querySelector("span:not(.teamName)")?.textContent?.trim() || "";
        result.team2Overs = (t2.querySelector("p")?.textContent?.trim() || "").replace(/\s+/g, " ");
      }

      const h3s = document.querySelectorAll(".score-top .container h3");
      // The result text (e.g., "Team won by X runs") is typically in h3[2]
      let statusText = "";
      for (let i = 0; i < h3s.length; i++) {
        const text = h3s[i]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";
        const lower = text.toLowerCase();
        if (lower.includes("won") || lower.includes("tied") || lower.includes("draw") || lower.includes("no result")) {
          statusText = text;
          break;
        }
      }
      if (!statusText) {
        statusText = h3s[0]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";
      }
      result.statusText = statusText;

      const status = statusText.toLowerCase();
      result.isCompleted =
        status.includes("won") ||
        status.includes("tied") ||
        status.includes("draw") ||
        status.includes("no result");

      // Extract match date from the page
      const dateEl = document.querySelector(".match-summary .match-date, .score-top .match-date");
      result.matchDate = dateEl?.textContent?.trim() || null;

      // Extract batting performances
      result.allBatting = [];
      result.allBowling = [];

      const tables = document.querySelectorAll("table");
      for (const table of tables) {
        const allCells = Array.from(table.querySelectorAll("th, td"));
        const cellTexts = allCells.map(c => c.textContent?.trim() || "");

        let rIdx = -1;
        for (let i = 0; i < cellTexts.length - 4; i++) {
          if (cellTexts[i] === "R" && cellTexts[i+1] === "B" &&
              cellTexts[i+2] === "4s" && cellTexts[i+3] === "6s" && cellTexts[i+4] === "SR") {
            rIdx = i;
            break;
          }
        }

        if (rIdx >= 0) {
          const stride = rIdx + 5;
          let i = stride;
          while (i + stride <= cellTexts.length) {
            const rawName = cellTexts[i] || "";
            const nameLower = rawName.toLowerCase();
            if (nameLower.includes("extras") || nameLower.includes("total") ||
                nameLower.includes("did not bat") || nameLower === "bowling" ||
                nameLower === "fall of wickets" || rawName === "O" || rawName === "W") break;

            const name = rawName.split("\n")[0].trim().replace(/[*†]/g, "").trim();
            const runsOffset = stride - 5;
            const runs = cellTexts[i + runsOffset] || "0";
            const balls = cellTexts[i + runsOffset + 1] || "0";
            const fours = cellTexts[i + runsOffset + 2] || "0";
            const sixes = cellTexts[i + runsOffset + 3] || "0";
            const sr = cellTexts[i + runsOffset + 4] || "0";

            if (name && !isNaN(parseInt(runs)) && !isNaN(parseFloat(sr))) {
              result.allBatting.push({ name, runs, balls, fours, sixes, sr });
            }
            i += stride;
          }
        }

        let bIdx = -1;
        for (let i = 0; i < cellTexts.length - 2; i++) {
          if ((cellTexts[i] === "Bowling" || cellTexts[i] === "Bowler") &&
              cellTexts[i+1] === "O" && cellTexts[i+2] === "M") {
            bIdx = i;
            break;
          }
        }

        if (bIdx >= 0) {
          const hasDot = cellTexts[bIdx + 3] === "Dot";
          const headerLen = hasDot ? 7 : 6;
          let i = bIdx + headerLen;
          while (i < cellTexts.length && cellTexts[i] === "") i++;

          while (i < cellTexts.length) {
            const rawName = cellTexts[i] || "";
            if (!rawName || rawName === "Bowling" || rawName === "O" || rawName === "Bowler") break;
            if (!isNaN(parseFloat(rawName)) || rawName.startsWith("(") || rawName.length <= 1) {
              i++;
              continue;
            }

            const name = rawName.split("\n")[0].trim().replace(/[*†]/g, "").trim();
            const overs = cellTexts[i + 1] || "";
            const maidens = cellTexts[i + 2] || "";
            let runs: string, wickets: string, econ: string;
            if (hasDot) {
              runs = cellTexts[i + 4] || "0";
              wickets = cellTexts[i + 5] || "0";
              econ = cellTexts[i + 6] || "0";
            } else {
              runs = cellTexts[i + 3] || "0";
              wickets = cellTexts[i + 4] || "0";
              econ = cellTexts[i + 5] || "0";
            }

            if (!isNaN(parseFloat(overs)) && !isNaN(parseInt(wickets))) {
              result.allBowling.push({ name, overs, maidens, runs, wickets, econ });
            }

            i += (hasDot ? 7 : 6);
            while (i < cellTexts.length && (cellTexts[i]?.startsWith("(") || cellTexts[i] === "")) {
              i++;
            }
          }
        }
      }

      return result;
    });

    if (data.team1Name || data.team2Name) {
      return data;
    }
    return null;
  } catch (err) {
    console.log(`    Scorecard scrape failed: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const isCI = !!process.env.CI;
  console.log(`Launching browser for match results backfill (headless: ${isCI})...`);
  const browser = await puppeteer.launch({
    headless: isCI,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  let totalSaved = 0;

  for (const team of teams) {
    console.log(`\nProcessing ${team.slug}...`);

    // Get the team schedule page to find all scorecard links
    const scheduleUrl = `${BASE_URL}/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
    try {
      await page.goto(scheduleUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, 3000));

      const scorecardLinks = await page.evaluate(() => {
        const links: { matchId: string; href: string; date: string | null }[] = [];

        // Search all tables — past results are in #schedule-table, future in #schedule-table1
        const rows = document.querySelectorAll("table tr");

        for (const row of rows) {
          const scoreLink = row.querySelector('a[href*="viewScorecard"]');
          if (!scoreLink) continue;

          const href = scoreLink.getAttribute("href") || "";
          const matchIdMatch = href.match(/matchId=(\d+)/);
          if (!matchIdMatch) continue;

          const cells = row.querySelectorAll("td");
          let date: string | null = null;
          for (const cell of cells) {
            const text = cell.textContent?.trim() || "";
            if (text.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
              date = text;
              break;
            }
          }

          links.push({ matchId: matchIdMatch[1], href, date });
        }

        const seen = new Set<string>();
        return links.filter((l) => {
          if (seen.has(l.matchId)) return false;
          seen.add(l.matchId);
          return true;
        });
      });

      console.log(`  Found ${scorecardLinks.length} scorecards for ${team.slug}`);

      for (const link of scorecardLinks) {
        const url = `${BASE_URL}${link.href}`;
        console.log(`  Scraping match ${link.matchId}...`);

        const data = await scrapeScorecard(page, url);
        if (!data) {
          console.log(`    No data extracted, skipping`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        if (!data.team1Score && !data.team2Score) {
          console.log(`    No scores yet (upcoming match), skipping`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        const teamSlug = determineTeamSlug(data.team1Name, data.team2Name) || team.slug;

        // Parse date — CricClubs uses MM/DD/YYYY format
        let matchDate: string | null = null;
        if (link.date) {
          const parts = link.date.split("/");
          if (parts.length === 3) {
            matchDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
          }
        }

        const { error } = await supabase.from("match_results").upsert(
          {
            match_id: link.matchId,
            team_slug: teamSlug,
            team1_name: data.team1Name,
            team1_score: data.team1Score || "",
            team1_overs: data.team1Overs || "",
            team2_name: data.team2Name,
            team2_score: data.team2Score || "",
            team2_overs: data.team2Overs || "",
            status_text: data.statusText || "",
            batting_summary: data.allBatting || [],
            bowling_summary: data.allBowling || [],
            scorecard_url: url,
            match_date: matchDate,
          },
          { onConflict: "match_id,team_slug" }
        );

        if (error) {
          console.log(`    DB error: ${error.message}`);
        } else {
          console.log(`    Saved: ${data.team1Name} ${data.team1Score} vs ${data.team2Name} ${data.team2Score}`);
          totalSaved++;
        }

        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.log(`  Schedule page failed for ${team.slug}: ${(err as Error).message}`);
    }
  }

  await browser.close();
  console.log(`\nDone. Saved ${totalSaved} match results.`);
}

main().catch(console.error);
