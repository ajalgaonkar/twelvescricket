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

  let totalPlayers = 0;

  for (const team of teams) {
    const url = `https://cricclubs.com/NWCL/viewTeam.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
    console.log(`\nFetching roster: ${team.slug}`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector(".team-player-all", { timeout: 15000 });
    } catch {
      console.log(`  Failed to load team page for ${team.slug}, skipping`);
      continue;
    }

    const players = await page.evaluate(() => {
      const results: { name: string; playerId: string; role: string; position: string | null; photoUrl: string | null; href: string }[] = [];
      const cards = document.querySelectorAll(".team-player-all");

      for (const card of cards) {
        const nameEl = card.querySelector(".team-player-text h4");
        const name = nameEl?.childNodes[0]?.textContent?.trim() || "";
        if (!name) continue;

        const role = card.querySelector(".team-player-text h5")?.textContent?.trim() || "Unknown";
        const position = card.querySelector(".team-player-pos h3")?.textContent?.trim() || null;
        const imgEl = card.querySelector(".team-player-image img") as HTMLImageElement;
        const photoUrl = imgEl?.src || null;
        const linkEl = card.querySelector("a.btn-team") as HTMLAnchorElement;
        const href = linkEl?.getAttribute("href") || "";
        const playerIdMatch = href.match(/playerId=(\d+)/);
        const playerId = playerIdMatch ? playerIdMatch[1] : "";

        if (playerId) {
          results.push({ name, playerId, role, position, photoUrl, href });
        }
      }
      return results;
    });

    console.log(`  Found ${players.length} players`);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      console.log(`  [${i + 1}/${players.length}] ${p.name}`);

      await supabase.from("players").upsert(
        {
          team_slug: team.slug,
          player_id: p.playerId,
          name: p.name,
          role: p.role,
          position: p.position,
          photo_url: p.photoUrl,
          profile_url: `https://cricclubs.com${p.href}`,
        },
        { onConflict: "team_slug,player_id" }
      );

      try {
        const statsUrl = `https://cricclubs.com/NWCL/viewPlayer.do?playerId=${p.playerId}&clubId=232`;
        await page.goto(statsUrl, { waitUntil: "networkidle2", timeout: 20000 });
        await page.waitForSelector(".table", { timeout: 10000 });

        const stats = await page.evaluate(() => {
          const batting: any[] = [];
          const bowling: any[] = [];

          const accordions = document.querySelectorAll("h2.resp-accordion");
          let inLeague = false;

          for (const accordion of accordions) {
            const title = accordion.textContent?.trim() || "";
            const titleUpper = title.toUpperCase();

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
                if ((row as HTMLElement).id?.includes("Grouping") || (row as HTMLElement).id?.includes("Series")) continue;
                if ((row as HTMLElement).style?.display === "none") continue;

                const seriesType = cells[0]?.querySelector("b")?.textContent?.trim() || "";
                if (!seriesType) continue;

                batting.push({
                  seriesType,
                  matches: parseInt(cells[1]?.textContent?.trim() || "0"),
                  innings: parseInt(cells[2]?.textContent?.trim() || "0"),
                  notOuts: parseInt(cells[3]?.textContent?.trim() || "0"),
                  runs: parseInt(cells[4]?.textContent?.trim() || "0"),
                  balls: parseInt(cells[5]?.textContent?.trim() || "0"),
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
                if ((row as HTMLElement).id?.includes("Grouping") || (row as HTMLElement).id?.includes("Series")) continue;
                if ((row as HTMLElement).style?.display === "none") continue;

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
                  fourWickets: parseInt(cells[11]?.textContent?.trim() || "0"),
                  fiveWickets: parseInt(cells[12]?.textContent?.trim() || "0"),
                  catches: parseInt(cells[14]?.textContent?.trim() || "0"),
                });
              }
            }
          }

          return { batting, bowling };
        });

        // Aggregate and save batting stats by format
        const battingByFormat = new Map<string, typeof stats.batting>();
        for (const r of stats.batting) {
          const existing = battingByFormat.get(r.seriesType) || [];
          existing.push(r);
          battingByFormat.set(r.seriesType, existing);
        }
        for (const [seriesType, rows] of battingByFormat) {
          const matches = rows.reduce((s: number, r: any) => s + r.matches, 0);
          const innings = rows.reduce((s: number, r: any) => s + r.innings, 0);
          const notOuts = rows.reduce((s: number, r: any) => s + r.notOuts, 0);
          const runs = rows.reduce((s: number, r: any) => s + r.runs, 0);
          const balls = rows.reduce((s: number, r: any) => s + r.balls, 0);
          const dismissals = innings - notOuts;
          const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : "0";
          const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0";
          const highScore = rows.reduce((best: string, r: any) => {
            const curr = parseInt(r.highScore) || 0;
            const prev = parseInt(best) || 0;
            return curr > prev ? r.highScore : best;
          }, "0");

          await supabase.from("batting_stats").upsert(
            {
              player_id: p.playerId,
              team_slug: team.slug,
              series_type: seriesType,
              matches,
              innings,
              not_outs: notOuts,
              runs,
              balls,
              average,
              strike_rate: strikeRate,
              high_score: highScore,
              hundreds: rows.reduce((s: number, r: any) => s + r.hundreds, 0),
              fifties: rows.reduce((s: number, r: any) => s + r.fifties, 0),
              fours: rows.reduce((s: number, r: any) => s + r.fours, 0),
              sixes: rows.reduce((s: number, r: any) => s + r.sixes, 0),
            },
            { onConflict: "player_id,team_slug,series_type" }
          );
        }

        // Aggregate and save bowling stats by format
        const bowlingByFormat = new Map<string, typeof stats.bowling>();
        for (const r of stats.bowling) {
          const existing = bowlingByFormat.get(r.seriesType) || [];
          existing.push(r);
          bowlingByFormat.set(r.seriesType, existing);
        }
        for (const [seriesType, rows] of bowlingByFormat) {
          const matches = rows.reduce((s: number, r: any) => s + r.matches, 0);
          const innings = rows.reduce((s: number, r: any) => s + r.innings, 0);
          const totalBalls = rows.reduce((s: number, r: any) => {
            const parts = String(r.overs).split(".");
            const full = parseInt(parts[0]) || 0;
            const partial = parseInt(parts[1]) || 0;
            return s + full * 6 + partial;
          }, 0);
          const oversWhole = Math.floor(totalBalls / 6);
          const oversPartial = totalBalls % 6;
          const overs = oversPartial > 0 ? `${oversWhole}.${oversPartial}` : String(oversWhole);
          const runs = rows.reduce((s: number, r: any) => s + r.runs, 0);
          const wickets = rows.reduce((s: number, r: any) => s + r.wickets, 0);
          const economy = totalBalls > 0 ? (runs / (totalBalls / 6)).toFixed(2) : "0";
          const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0";
          const strikeRate = wickets > 0 ? (totalBalls / wickets).toFixed(2) : "0";
          const bestFigures = rows.reduce((best: string, r: any) => {
            if (best === "-") return r.bestFigures;
            const [bw] = best.split("/").map(Number);
            const [sw] = r.bestFigures.split("/").map(Number);
            return (sw || 0) > (bw || 0) ? r.bestFigures : best;
          }, "-");

          await supabase.from("bowling_stats").upsert(
            {
              player_id: p.playerId,
              team_slug: team.slug,
              series_type: seriesType,
              matches,
              innings,
              overs,
              runs,
              wickets,
              best_figures: bestFigures,
              maidens: rows.reduce((s: number, r: any) => s + r.maidens, 0),
              average,
              economy,
              strike_rate: strikeRate,
              four_wickets: rows.reduce((s: number, r: any) => s + r.fourWickets, 0),
              five_wickets: rows.reduce((s: number, r: any) => s + r.fiveWickets, 0),
              catches: rows.reduce((s: number, r: any) => s + r.catches, 0),
            },
            { onConflict: "player_id,team_slug,series_type" }
          );
        }

        totalPlayers++;
      } catch {
        console.log(`    Stats fetch failed for ${p.name}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await browser.close();
  console.log(`\nDone. Updated stats for ${totalPlayers} players.`);
}

main().catch(console.error);
