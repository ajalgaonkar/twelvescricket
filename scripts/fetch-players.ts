import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";

interface BattingStats {
  seriesType: string;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  average: string;
  strikeRate: string;
  highScore: string;
  hundreds: number;
  fifties: number;
  fours: number;
  sixes: number;
}

interface BowlingStats {
  seriesType: string;
  matches: number;
  innings: number;
  overs: string;
  runs: number;
  wickets: number;
  bestFigures: string;
  maidens: number;
  average: string;
  economy: string;
  strikeRate: string;
  fourWickets: number;
  fiveWickets: number;
  catches: number;
}

interface Player {
  name: string;
  playerId: string;
  role: string;
  position: string | null;
  photoUrl: string | null;
  profileUrl: string;
  batting: BattingStats[];
  bowling: BowlingStats[];
}

interface TeamConfig {
  slug: string;
  name: string;
  teamId: number;
  leagueId: number;
  clubId: number;
}

const teams: TeamConfig[] = [
  { slug: "copters", name: "Twelves Copters", teamId: 1455, leagueId: 160, clubId: 232 },
  { slug: "drones", name: "Twelves Drones", teamId: 1470, leagueId: 161, clubId: 232 },
  { slug: "jets", name: "Twelves Jets", teamId: 1480, leagueId: 162, clubId: 232 },
  { slug: "rockets", name: "Twelves Rockets", teamId: 1494, leagueId: 163, clubId: 232 },
];

async function fetchTeamPlayers(page: puppeteer.Page, team: TeamConfig): Promise<Player[]> {
  const url = `https://cricclubs.com/NWCL/viewTeam.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
  console.log(`\nFetching roster: ${team.name}`);

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector(".team-player-all", { timeout: 15000 });

  const players = await page.evaluate(() => {
    const results: Omit<Player, "batting" | "bowling">[] = [];
    const cards = document.querySelectorAll(".team-player-all");

    for (const card of cards) {
      const nameEl = card.querySelector(".team-player-text h4");
      const name = nameEl?.childNodes[0]?.textContent?.trim() || "";
      if (!name) continue;

      const roleEl = card.querySelector(".team-player-text h5");
      const role = roleEl?.textContent?.trim() || "Unknown";

      const posEl = card.querySelector(".team-player-pos h3");
      const position = posEl?.textContent?.trim() || null;

      const imgEl = card.querySelector(".team-player-image img") as HTMLImageElement;
      const photoUrl = imgEl?.src || null;

      const linkEl = card.querySelector("a.btn-team") as HTMLAnchorElement;
      const href = linkEl?.getAttribute("href") || "";
      const playerIdMatch = href.match(/playerId=(\d+)/);
      const playerId = playerIdMatch ? playerIdMatch[1] : "";

      results.push({
        name,
        playerId,
        role,
        position,
        photoUrl,
        profileUrl: `https://cricclubs.com${href}`,
      });
    }

    return results;
  });

  console.log(`  Found ${players.length} players for ${team.name}`);
  return players.map((p) => ({ ...p, batting: [], bowling: [] }));
}

async function fetchPlayerStats(page: puppeteer.Page, player: Player): Promise<Player> {
  if (!player.playerId) return player;

  const url = `https://cricclubs.com/NWCL/viewPlayer.do?playerId=${player.playerId}&clubId=232`;

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    await page.waitForSelector(".table", { timeout: 10000 });

    const stats = await page.evaluate(() => {
      const batting: BattingStats[] = [];
      const bowling: BowlingStats[] = [];

      // Find all accordion headings — scrape stats from all leagues except ARCL
      const accordions = document.querySelectorAll("h2.resp-accordion");
      let inLeague = false;

      for (const accordion of accordions) {
        const title = accordion.textContent?.trim() || "";
        const titleUpper = title.toUpperCase();

        // League headings don't contain BATTING or BOWLING
        if (!titleUpper.includes("BATTING") && !titleUpper.includes("BOWLING")) {
          inLeague = !titleUpper.includes("ARCL");
          continue;
        }

        if (!inLeague) continue;

        const content = accordion.nextElementSibling;
        if (!content) continue;

        const rows = content.querySelectorAll("table.table tbody tr");

        if (titleUpper.includes("BATTING")) {
          for (const row of rows) {
            const cells = row.querySelectorAll("th");
            if (cells.length < 10) continue;
            if (row.id?.includes("Grouping") || row.id?.includes("Series")) continue;
            if (row.style?.display === "none") continue;

            const seriesType = cells[0]?.querySelector("b")?.textContent?.trim() || "";
            if (!seriesType) continue;

            batting.push({
              seriesType,
              matches: parseInt(cells[1]?.textContent?.trim() || "0"),
              innings: parseInt(cells[2]?.textContent?.trim() || "0"),
              notOuts: parseInt(cells[3]?.textContent?.trim() || "0"),
              runs: parseInt(cells[4]?.textContent?.trim() || "0"),
              balls: parseInt(cells[5]?.textContent?.trim() || "0"),
              average: cells[6]?.textContent?.trim() || "0",
              strikeRate: cells[7]?.textContent?.trim() || "0",
              highScore: cells[8]?.textContent?.trim() || "0",
              hundreds: parseInt(cells[9]?.textContent?.trim() || "0"),
              fifties: parseInt(cells[10]?.textContent?.trim() || "0"),
              fours: parseInt(cells[13]?.textContent?.trim() || "0"),
              sixes: parseInt(cells[14]?.textContent?.trim() || "0"),
            });
          }
        } else if (titleUpper.includes("BOWLING")) {
          for (const row of rows) {
            const cells = row.querySelectorAll("th");
            if (cells.length < 10) continue;
            if (row.id?.includes("Grouping") || row.id?.includes("Series")) continue;
            if (row.style?.display === "none") continue;

            const seriesType = cells[0]?.querySelector("b")?.textContent?.trim() || "";
            if (!seriesType) continue;

            bowling.push({
              seriesType,
              matches: parseInt(cells[1]?.textContent?.trim() || "0"),
              innings: parseInt(cells[2]?.textContent?.trim() || "0"),
              overs: cells[3]?.textContent?.trim() || "0",
              runs: parseInt(cells[4]?.textContent?.trim() || "0"),
              wickets: parseInt(cells[5]?.textContent?.trim() || "0"),
              bestFigures: cells[6]?.textContent?.trim() || "-",
              maidens: parseInt(cells[7]?.textContent?.trim() || "0"),
              average: cells[8]?.textContent?.trim() || "0",
              economy: cells[9]?.textContent?.trim() || "0",
              strikeRate: cells[10]?.textContent?.trim() || "0",
              fourWickets: parseInt(cells[11]?.textContent?.trim() || "0"),
              fiveWickets: parseInt(cells[12]?.textContent?.trim() || "0"),
              catches: parseInt(cells[14]?.textContent?.trim() || "0"),
            });
          }
        }
      }

      return { batting, bowling };
    });

    return { ...player, ...stats };
  } catch (error) {
    console.log(`    Stats fetch failed for ${player.name}`);
    return player;
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

  const allPlayers: Record<string, { team: string; players: Player[]; fetchedAt: string }> = {};

  for (const team of teams) {
    const players = await fetchTeamPlayers(page, team);

    // Fetch stats for each player
    console.log(`  Fetching individual player stats...`);
    const playersWithStats: Player[] = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      console.log(`    [${i + 1}/${players.length}] ${p.name}`);
      const withStats = await fetchPlayerStats(page, p);
      playersWithStats.push(withStats);
      await new Promise((r) => setTimeout(r, 1000));
    }

    allPlayers[team.slug] = {
      team: team.name,
      players: playersWithStats,
      fetchedAt: new Date().toISOString(),
    };

    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  const outputPath = path.join(__dirname, "../src/data/players.json");
  fs.writeFileSync(outputPath, JSON.stringify(allPlayers, null, 2));
  console.log(`\nPlayers saved to ${outputPath}`);
  const totalPlayers = Object.values(allPlayers).reduce((s, t) => s + t.players.length, 0);
  console.log(`Total players: ${totalPlayers}`);
}

main().catch(console.error);
