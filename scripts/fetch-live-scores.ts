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
      // Find the actual match status h3 (not the tournament/series name)
      let statusText = "";
      for (let i = 0; i < h3s.length; i++) {
        const text = h3s[i]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";
        const lower = text.toLowerCase();
        if (lower.includes("won") || lower.includes("tied") || lower.includes("draw") ||
            lower.includes("no result") || lower.includes("runs needed") ||
            lower.includes("wickets remaining") || lower.includes("overs remaining") ||
            lower.includes("yet to bat") || lower.includes("innings break") ||
            lower.includes("in progress") || lower.includes("1st innings") ||
            lower.includes("2nd innings")) {
          statusText = text;
          break;
        }
      }
      if (!statusText) {
        statusText = h3s[h3s.length - 1]?.textContent?.trim().replace(/DLS.*$/, "").trim() || "";
      }
      result.statusText = statusText;

      const status = result.statusText.toLowerCase();
      result.isLive =
        status.includes("runs needed") ||
        status.includes("wickets remaining") ||
        status.includes("overs remaining") ||
        status.includes("yet to bat") ||
        status.includes("innings break") ||
        status.includes("in progress") ||
        status.includes("1st innings") ||
        status.includes("2nd innings");
      result.isCompleted =
        status.includes("won") ||
        status.includes("tied") ||
        status.includes("draw") ||
        status.includes("no result");

      // Extract ALL batting and bowling performances from the full scorecard.
      // CricClubs renders scorecard data as <th> elements in a flat structure.
      // Completed scorecard pattern (per table):
      //   Batting: [InningsTitle, InningsTitle2, R, B, 4s, 6s, SR, Name, HowOut, R, B, 4s, 6s, SR, ...]
      //   Bowling: [Bowling, O, M, Dot, R, W, Econ, ||, Name, O, M, Dot, R, W, Econ, (extras), ||, ...]
      // Live scorecard pattern:
      //   [Batter, R, B, 4s, 6s, SR, Name, R, B, 4s, 6s, SR, ...]
      //   [Bowler, O, M, R, W, Econ, Name, O, M, R, W, Econ, ...]
      result.allBatting = [];
      result.allBowling = [];

      const tables = document.querySelectorAll("table");

      for (const table of tables) {
        const allCells = Array.from(table.querySelectorAll("th, td"));
        const cellTexts = allCells.map(c => c.textContent?.trim() || "");

        // BATTING: Find "R|B|4s|6s|SR" header sequence
        let rIdx = -1;
        for (let i = 0; i < cellTexts.length - 4; i++) {
          if (cellTexts[i] === "R" && cellTexts[i+1] === "B" &&
              cellTexts[i+2] === "4s" && cellTexts[i+3] === "6s" && cellTexts[i+4] === "SR") {
            rIdx = i;
            break;
          }
        }

        if (rIdx >= 0) {
          // Determine stride: number of cells per row
          // If rIdx >= 2 (e.g., InningsTitle, InningsTitle2, R, B, 4s, 6s, SR) => stride = rIdx + 5
          // If rIdx == 1 (e.g., Batter, R, B, 4s, 6s, SR) => stride = 6
          const stride = rIdx + 5;
          let i = stride; // skip header row

          while (i + stride <= cellTexts.length) {
            const rawName = cellTexts[i] || "";
            const nameLower = rawName.toLowerCase();

            // Stop at extras/total/end markers
            if (nameLower.includes("extras") || nameLower.includes("total") ||
                nameLower.includes("did not bat") || nameLower === "bowling" ||
                nameLower === "fall of wickets" || rawName === "O" || rawName === "W") break;

            // CricClubs embeds "How Out" in the name cell after newlines — extract just the name
            const name = rawName.split("\n")[0].trim().replace(/[*†]/g, "").trim();

            // For stride=7 (completed): [Name, HowOut, R, B, 4s, 6s, SR]
            // For stride=6 (live): [Name, R, B, 4s, 6s, SR]
            const runsOffset = stride - 5; // 2 for stride=7, 1 for stride=6
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

        // BOWLING: Find "Bowling|O|M" or "Bowler|O|M" header sequence
        let bIdx = -1;
        for (let i = 0; i < cellTexts.length - 2; i++) {
          if ((cellTexts[i] === "Bowling" || cellTexts[i] === "Bowler") &&
              cellTexts[i+1] === "O" && cellTexts[i+2] === "M") {
            bIdx = i;
            break;
          }
        }

        if (bIdx >= 0) {
          // Determine if there's a "Dot" column: Bowling|O|M|Dot|R|W|Econ
          const hasDot = cellTexts[bIdx + 3] === "Dot";
          const headerLen = hasDot ? 7 : 6;
          // Data stride includes trailing empty/parenthetical cells
          // From debug: Name|O|M|Dot|R|W|Econ|(extras)||
          // So stride = headerLen + 2 (trailing cells) for completed, or headerLen for live

          let i = bIdx + headerLen;
          // Skip empty cells after header
          while (i < cellTexts.length && cellTexts[i] === "") i++;

          while (i < cellTexts.length) {
            const rawName = cellTexts[i] || "";
            if (!rawName || rawName === "Bowling" || rawName === "O" || rawName === "Bowler") break;

            // Skip non-name entries (numbers, parentheticals, empty)
            if (!isNaN(parseFloat(rawName)) || rawName.startsWith("(") || rawName.length <= 1) {
              i++;
              continue;
            }

            const name = rawName.split("\n")[0].trim().replace(/[*†]/g, "").trim();
            const overs = cellTexts[i + 1] || "";
            const maidens = cellTexts[i + 2] || "";
            let runs: string, wickets: string, econ: string;
            if (hasDot) {
              // Name|O|M|Dot|R|W|Econ
              runs = cellTexts[i + 4] || "0";
              wickets = cellTexts[i + 5] || "0";
              econ = cellTexts[i + 6] || "0";
            } else {
              // Name|O|M|R|W|Econ
              runs = cellTexts[i + 3] || "0";
              wickets = cellTexts[i + 4] || "0";
              econ = cellTexts[i + 5] || "0";
            }

            if (!isNaN(parseFloat(overs)) && !isNaN(parseInt(wickets))) {
              result.allBowling.push({ name, overs, maidens, runs, wickets, econ });
            }

            // Advance past this bowler's data
            i += (hasDot ? 7 : 6);
            // Skip trailing parenthetical (e.g., "(6 w)") and empty cells
            while (i < cellTexts.length && (cellTexts[i]?.startsWith("(") || cellTexts[i] === "")) {
              i++;
            }
          }
        }
      }

      result.battingNow = result.allBatting;
      result.bowlingNow = result.allBowling;

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
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

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
        console.log(`    Batting: ${liveData.allBatting?.length || 0}, Bowling: ${liveData.allBowling?.length || 0}`);

        await saveToDb(link.matchId, teamSlug, liveData);
        scrapedMatchIds.add(link.matchId);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err) {
    console.log(`  Fixtures page failed: ${(err as Error).message}`);
  }

  // Also check individual team schedule pages for recent scorecards we missed
  const teams = [
    { slug: "copters", teamId: 1455, leagueId: 160, clubId: 232 },
    { slug: "drones", teamId: 1470, leagueId: 161, clubId: 232 },
    { slug: "jets", teamId: 1480, leagueId: 162, clubId: 232 },
    { slug: "rockets", teamId: 1494, leagueId: 163, clubId: 232 },
  ];

  for (const team of teams) {
    console.log(`\nChecking team schedule page: ${team.slug}...`);
    try {
      const scheduleUrl = `${BASE_URL}/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
      await page.goto(scheduleUrl, { waitUntil: "networkidle2", timeout: 25000 });

      const teamScorecardLinks = await page.evaluate(() => {
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
        return links.filter((l) => {
          if (seen.has(l.matchId)) return false;
          seen.add(l.matchId);
          return true;
        }).sort((a, b) => Number(b.matchId) - Number(a.matchId)).slice(0, 3);
      });

      for (const link of teamScorecardLinks) {
        if (scrapedMatchIds.has(link.matchId)) continue;

        const url = `${BASE_URL}${link.href}`;
        console.log(`  Scraping match ${link.matchId} from ${team.slug} schedule...`);

        const liveData = await scrapeScorecard(page, url);
        if (liveData) {
          const teamSlug = determineTeamSlug(liveData.team1Name, liveData.team2Name) || team.slug;
          const statusLabel = liveData.isLive ? "LIVE" : liveData.isCompleted ? "COMPLETED" : "IN PROGRESS";
          console.log(`    ${liveData.team1Name} ${liveData.team1Score || "—"} vs ${liveData.team2Name} ${liveData.team2Score || "—"}`);
          console.log(`    Status: ${statusLabel} - ${liveData.statusText || "(no status)"}`);

          await saveToDb(link.matchId, teamSlug, liveData);
          scrapedMatchIds.add(link.matchId);
        }

        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      console.log(`  Team schedule page failed for ${team.slug}: ${(err as Error).message}`);
    }
  }

  await browser.close();

  // Persist any completed matches from live_scores to match_results
  try {
    const { data: allLive } = await supabase.from("live_scores").select("*");
    if (allLive) {
      for (const ls of allLive) {
        const statusLower = (ls.status_text || "").toLowerCase();
        const isCompleted =
          statusLower.includes("won") ||
          statusLower.includes("tied") ||
          statusLower.includes("draw") ||
          statusLower.includes("no result");

        const t1Score = ls.team1_score || "";
        const t2Score = ls.team2_score || "";
        const t1Runs = parseInt(t1Score) || 0;
        const t2Runs = parseInt(t2Score) || 0;
        const bothBatted = !!(t1Score && t2Score);
        const chaseComplete = bothBatted && (t2Runs > t1Runs || t2Score.includes("/10"));

        if ((isCompleted || chaseComplete) && (t1Score || t2Score)) {
          const { error: mrError } = await supabase.from("match_results").upsert(
            {
              match_id: ls.match_id,
              team_slug: ls.team_slug,
              team1_name: ls.team1_name,
              team1_score: ls.team1_score || "",
              team1_overs: ls.team1_overs || "",
              team2_name: ls.team2_name,
              team2_score: ls.team2_score || "",
              team2_overs: ls.team2_overs || "",
              status_text: ls.status_text || "",
              batting_summary: ls.batting_now || [],
              bowling_summary: ls.bowling_now || [],
              scorecard_url: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${ls.match_id}&clubId=${CLUB_ID}`,
              match_date: new Date(ls.updated_at).toISOString().split("T")[0],
            },
            { onConflict: "match_id,team_slug" }
          );
          if (!mrError) {
            console.log(`Persisted completed match ${ls.match_id} (${ls.team1_name} vs ${ls.team2_name}) to match_results.`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`Failed to persist completed matches: ${(err as Error).message}`);
  }

  // Only clean up old entries if we successfully scraped new data
  if (scrapedMatchIds.size > 0) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("live_scores").delete().lt("updated_at", weekAgo);
    console.log("Removed entries older than 7 days.");
  }

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

  // Also persist completed matches to match_results for permanent history
  if (liveData.isCompleted && (liveData.team1Score || liveData.team2Score)) {
    const { error: mrError } = await supabase.from("match_results").upsert(
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
        batting_summary: liveData.allBatting || liveData.battingNow || [],
        bowling_summary: liveData.allBowling || liveData.bowlingNow || [],
        scorecard_url: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${matchId}&clubId=${CLUB_ID}`,
        match_date: new Date().toISOString().split("T")[0],
      },
      { onConflict: "match_id,team_slug" }
    );
    if (mrError) {
      console.log(`    match_results error: ${mrError.message}`);
    } else {
      console.log(`    Also saved to match_results.`);
    }
  }
}

main().catch(console.error);
