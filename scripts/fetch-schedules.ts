import puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";

interface Match {
  matchId: string;
  date: string;
  time: string;
  matchType: string;
  series: string;
  division: string;
  team1: string;
  team2: string;
  ground: string;
  result: string | null;
  scorecardUrl: string | null;
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

async function fetchTeamSchedule(
  page: puppeteer.Page,
  team: TeamConfig
): Promise<Match[]> {
  const url = `https://cricclubs.com/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
  console.log(`Fetching: ${team.name} — ${url}`);

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector("#schedule-table1, #attTable", { timeout: 15000 });

    const matches = await page.evaluate((teamName: string) => {
      const results: Match[] = [];
      const seen = new Set<string>();

      // Primary source: #attTable (hidden export table with clean data)
      // Columns: #, Series, Division, Match Type, Date, Time, Team One, Team Two, Ground, Umpire1-4, Match Manager, Scorer1-2
      const attTable = document.querySelector("#attTable");
      if (attTable) {
        const rows = attTable.querySelectorAll("tbody tr");
        for (const row of rows) {
          const cells = row.querySelectorAll("td");
          if (cells.length < 9) continue;

          const series = cells[1]?.textContent?.trim() || "";
          const division = cells[2]?.textContent?.trim() || "";
          const matchType = cells[3]?.textContent?.trim() || "";
          const date = cells[4]?.textContent?.trim() || "";
          const time = cells[5]?.textContent?.trim() || "";
          const team1 = cells[6]?.textContent?.trim() || "";
          const team2 = cells[7]?.textContent?.trim() || "";
          const ground = cells[8]?.textContent?.trim() || "";

          const key = `${date}-${team1}-${team2}`;
          if (date && !seen.has(key)) {
            seen.add(key);
            results.push({
              matchId: `${date.replace(/\//g, "")}-${results.length}`,
              date,
              time,
              matchType,
              series,
              division,
              team1,
              team2,
              ground,
              result: null,
              scorecardUrl: null,
            });
          }
        }
      }

      // If attTable didn't work, fall back to #schedule-table1
      // Columns: #, Match Type, Date, Time, Team1(Home), Team2, Ground, Umpire1, Umpire2, Scorecard
      if (results.length === 0) {
        const schedTable = document.querySelector("#schedule-table1");
        if (schedTable) {
          const rows = schedTable.querySelectorAll("tbody tr");
          for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 7) continue;

            const matchType = cells[1]?.textContent?.trim() || "";
            const date = cells[2]?.textContent?.trim() || "";
            const time = cells[3]?.textContent?.trim() || "";
            // Team names are inside <a> tags within <div> containers
            const team1Link = cells[4]?.querySelector("a");
            const team2Link = cells[5]?.querySelector("a");
            const team1 = team1Link?.textContent?.trim() || cells[4]?.textContent?.trim() || "";
            const team2 = team2Link?.textContent?.trim() || cells[5]?.textContent?.trim() || "";
            const groundLink = cells[6]?.querySelector("a");
            const ground = groundLink?.textContent?.trim() || cells[6]?.textContent?.trim() || "";
            const scorecardCell = cells[9] || cells[cells.length - 1];
            const scorecardLink = scorecardCell?.querySelector("a");
            const scorecardHref = scorecardLink?.getAttribute("href") || null;
            const scorecardUrl = scorecardHref
              ? `https://cricclubs.com${scorecardHref}`
              : null;
            const matchIdMatch = scorecardHref?.match(/matchId=(\d+)/);
            const fixtureIdMatch = (row as HTMLElement).id?.match(/deleteRow(\d+)/);
            const matchId = matchIdMatch
              ? matchIdMatch[1]
              : fixtureIdMatch
                ? fixtureIdMatch[1]
                : `${Date.now()}-${results.length}`;

            const key = `${date}-${team1}-${team2}`;
            if (date && !seen.has(key)) {
              seen.add(key);
              results.push({
                matchId,
                date,
                time,
                matchType,
                series: "",
                division: "",
                team1,
                team2,
                ground,
                result: null,
                scorecardUrl,
              });
            }
          }
        }
      }

      return results;
    }, team.name);

    console.log(`  Found ${matches.length} matches for ${team.name}`);
    return matches;
  } catch (error) {
    console.error(`  Error fetching ${team.name}:`, error);
    return [];
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

  const allSchedules: Record<string, { team: string; matches: Match[]; fetchedAt: string }> = {};

  for (const team of teams) {
    const matches = await fetchTeamSchedule(page, team);
    allSchedules[team.slug] = {
      team: team.name,
      matches,
      fetchedAt: new Date().toISOString(),
    };
    await new Promise((r) => setTimeout(r, 2000));
  }

  await browser.close();

  const outputPath = path.join(__dirname, "../src/data/schedules.json");
  fs.writeFileSync(outputPath, JSON.stringify(allSchedules, null, 2));
  console.log(`\nSchedules saved to ${outputPath}`);
  console.log(
    `Total matches: ${Object.values(allSchedules).reduce((sum, s) => sum + s.matches.length, 0)}`
  );
}

main().catch(console.error);
