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

const TEAMS = [
  { slug: "copters", league: 160, teamId: 1455, name: "Twelves Copters" },
  { slug: "drones", league: 161, teamId: 1470, name: "Twelves Drones" },
  { slug: "jets", league: 162, teamId: 1480, name: "Twelves Jets" },
  { slug: "rockets", league: 163, teamId: 1494, name: "Twelves Rockets" },
  { slug: "twelves", league: 165, teamId: 1516, name: "Twelves Cricket Club (Century Cup T20)" },
];

interface BattingRecord {
  playerName: string;
  playerId: string;
  teamSlug: string;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  highScore: string;
  average: string;
  strikeRate: string;
  hundreds: number;
  fifties: number;
  fours: number;
  sixes: number;
}

interface BowlingRecord {
  playerName: string;
  playerId: string;
  teamSlug: string;
  matches: number;
  innings: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  bestFigures: string;
  average: string;
  economy: string;
  strikeRate: string;
  fourWickets: number;
  fiveWickets: number;
}

async function gotoWithRetry(page: puppeteer.Page, url: string, retries = 2): Promise<void> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await page.waitForSelector("table", { timeout: 15000 });
      return;
    } catch (e) {
      if (attempt === retries) throw e;
      console.log(`    Retry ${attempt + 1}...`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function scrapeTeamBatting(
  page: puppeteer.Page,
  team: (typeof TEAMS)[number]
): Promise<BattingRecord[]> {
  const url = `${BASE_URL}/NWCL/battingRecords.do?league=${team.league}&teamId=${team.teamId}&clubId=${CLUB_ID}`;
  console.log(`  Batting: ${url}`);

  await gotoWithRetry(page, url);

  const records = await page.evaluate(() => {
    const results: any[] = [];
    const tables = document.querySelectorAll("table");

    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll("thead th, thead td")).map(
        (h) => h.textContent?.trim().toLowerCase() || ""
      );

      const hasPlayer = headers.includes("player");
      const hasRuns = headers.includes("runs");
      if (!hasPlayer || !hasRuns) continue;

      const rows = table.querySelectorAll("tbody tr");
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 10) continue;

        const playerCell = cells[1];
        const playerLink = playerCell?.querySelector("a");
        const playerName =
          playerLink?.textContent?.trim() || playerCell?.textContent?.trim() || "";
        const href = playerLink?.getAttribute("href") || "";
        const playerIdMatch = href.match(/playerId=(\d+)/);
        const playerId = playerIdMatch ? playerIdMatch[1] : "";

        if (!playerName) continue;

        results.push({
          playerName,
          playerId,
          matches: parseInt(cells[3]?.textContent?.trim() || "0") || 0,
          innings: parseInt(cells[4]?.textContent?.trim() || "0") || 0,
          notOuts: parseInt(cells[5]?.textContent?.trim() || "0") || 0,
          runs: parseInt(cells[6]?.textContent?.trim() || "0") || 0,
          balls: 0,
          highScore: cells[11]?.textContent?.trim() || "0",
          average: cells[13]?.textContent?.trim() || "0",
          strikeRate: cells[12]?.textContent?.trim() || "0",
          hundreds: parseInt(cells[10]?.textContent?.trim() || "0") || 0,
          fifties: parseInt(cells[9]?.textContent?.trim() || "0") || 0,
          fours: parseInt(cells[7]?.textContent?.trim() || "0") || 0,
          sixes: parseInt(cells[8]?.textContent?.trim() || "0") || 0,
        });
      }

      if (results.length > 0) break;
    }

    return results;
  });

  return records.map((r) => ({ ...r, teamSlug: team.slug }));
}

async function scrapeTeamBowling(
  page: puppeteer.Page,
  team: (typeof TEAMS)[number]
): Promise<BowlingRecord[]> {
  const url = `${BASE_URL}/NWCL/bowlingRecords.do?league=${team.league}&teamId=${team.teamId}&clubId=${CLUB_ID}`;
  console.log(`  Bowling: ${url}`);

  await gotoWithRetry(page, url);

  const records = await page.evaluate(() => {
    const results: any[] = [];
    const tables = document.querySelectorAll("table");

    for (const table of tables) {
      const headers = Array.from(table.querySelectorAll("thead th, thead td")).map(
        (h) => h.textContent?.trim().toLowerCase() || ""
      );

      const hasPlayer = headers.includes("player");
      const hasWickets = headers.includes("wkts");
      if (!hasPlayer || !hasWickets) continue;

      const rows = table.querySelectorAll("tbody tr");
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 10) continue;

        const playerCell = cells[1];
        const playerLink = playerCell?.querySelector("a");
        const playerName =
          playerLink?.textContent?.trim() || playerCell?.textContent?.trim() || "";
        const href = playerLink?.getAttribute("href") || "";
        const playerIdMatch = href.match(/playerId=(\d+)/);
        const playerId = playerIdMatch ? playerIdMatch[1] : "";

        if (!playerName) continue;

        // BBF format is "runs/wickets" e.g. "18/ 3" — convert to "3/18"
        const bbfRaw = cells[8]?.textContent?.trim() || "-";
        let bestFigures = "-";
        const bbfMatch = bbfRaw.match(/(\d+)\s*\/\s*(\d+)/);
        if (bbfMatch) {
          bestFigures = `${bbfMatch[2]}/${bbfMatch[1]}`;
        }

        results.push({
          playerName,
          playerId,
          matches: parseInt(cells[3]?.textContent?.trim() || "0") || 0,
          innings: parseInt(cells[4]?.textContent?.trim() || "0") || 0,
          overs: cells[5]?.textContent?.trim() || "0",
          maidens: parseInt(cells[9]?.textContent?.trim() || "0") || 0,
          runs: parseInt(cells[6]?.textContent?.trim() || "0") || 0,
          wickets: parseInt(cells[7]?.textContent?.trim() || "0") || 0,
          bestFigures,
          average: cells[12]?.textContent?.trim() || "0",
          economy: cells[11]?.textContent?.trim() || "0",
          strikeRate: cells[13]?.textContent?.trim() || "0",
          fourWickets: parseInt(cells[15]?.textContent?.trim() || "0") || 0,
          fiveWickets: parseInt(cells[16]?.textContent?.trim() || "0") || 0,
        });
      }

      if (results.length > 0) break;
    }

    return results;
  });

  return records.map((r) => ({ ...r, teamSlug: team.slug }));
}

async function main() {
  const season = 2026;
  console.log(`Fetching ${season} season stats for Twelves Cricket Club (per-team)...\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  let allBatting: BattingRecord[] = [];
  let allBowling: BowlingRecord[] = [];

  for (const team of TEAMS) {
    console.log(`${team.name} (league=${team.league}, teamId=${team.teamId}):`);

    const batting = await scrapeTeamBatting(page, team);
    console.log(`    Found ${batting.length} batting records`);
    allBatting = allBatting.concat(batting);

    const bowling = await scrapeTeamBowling(page, team);
    console.log(`    Found ${bowling.length} bowling records\n`);
    allBowling = allBowling.concat(bowling);
  }

  await browser.close();

  console.log(`Total: ${allBatting.length} batting, ${allBowling.length} bowling records`);

  // Clear existing data for this season before upserting
  const { error: clearBatErr } = await supabase
    .from("season_batting_stats")
    .delete()
    .eq("season", season);
  if (clearBatErr) console.log(`  Warning: could not clear old batting data: ${clearBatErr.message}`);

  const { error: clearBowlErr } = await supabase
    .from("season_bowling_stats")
    .delete()
    .eq("season", season);
  if (clearBowlErr) console.log(`  Warning: could not clear old bowling data: ${clearBowlErr.message}`);

  // Upsert batting records
  let battingSaved = 0;
  for (const r of allBatting) {
    const { error } = await supabase.from("season_batting_stats").upsert(
      {
        season,
        player_id: r.playerId,
        player_name: r.playerName,
        team_slug: r.teamSlug,
        matches: r.matches,
        innings: r.innings,
        not_outs: r.notOuts,
        runs: r.runs,
        balls: r.balls,
        high_score: r.highScore,
        average: r.average,
        strike_rate: r.strikeRate,
        hundreds: r.hundreds,
        fifties: r.fifties,
        fours: r.fours,
        sixes: r.sixes,
      },
      { onConflict: "season,player_id,team_slug" }
    );
    if (error) {
      console.log(`  Batting upsert error for ${r.playerName}: ${error.message}`);
    } else {
      battingSaved++;
    }
  }

  // Upsert bowling records
  let bowlingSaved = 0;
  for (const r of allBowling) {
    const { error } = await supabase.from("season_bowling_stats").upsert(
      {
        season,
        player_id: r.playerId,
        player_name: r.playerName,
        team_slug: r.teamSlug,
        matches: r.matches,
        innings: r.innings,
        overs: r.overs,
        maidens: r.maidens,
        runs: r.runs,
        wickets: r.wickets,
        best_figures: r.bestFigures,
        average: r.average,
        economy: r.economy,
        strike_rate: r.strikeRate,
        four_wickets: r.fourWickets,
        five_wickets: r.fiveWickets,
      },
      { onConflict: "season,player_id,team_slug" }
    );
    if (error) {
      console.log(`  Bowling upsert error for ${r.playerName}: ${error.message}`);
    } else {
      bowlingSaved++;
    }
  }

  console.log(`\nDone. Saved ${battingSaved} batting, ${bowlingSaved} bowling records for ${season}.`);
}

main().catch(console.error);
