import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as cheerio from "cheerio";

const teams = [
  { slug: "copters", teamId: 1455, leagueId: 160, clubId: 232 },
  { slug: "drones", teamId: 1470, leagueId: 161, clubId: 232 },
  { slug: "jets", teamId: 1480, leagueId: 162, clubId: 232 },
  { slug: "rockets", teamId: 1494, leagueId: 163, clubId: 232 },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  for (const team of teams) {
    try {
      const url = `https://cricclubs.com/NWCL/viewTeam.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      const html = await res.text();
      const $ = cheerio.load(html);

      let count = 0;
      const playerCards = $(".team-player-all");

      for (let i = 0; i < playerCards.length; i++) {
        const card = $(playerCards[i]);
        const nameEl = card.find(".team-player-text h4");
        const name = nameEl.contents().first().text().trim();
        if (!name) continue;

        const role = card.find(".team-player-text h5").text().trim() || "Unknown";
        const position = card.find(".team-player-pos h3").text().trim() || null;
        const photoUrl = card.find(".team-player-image img").attr("src") || null;
        const href = card.find("a.btn-team").attr("href") || "";
        const playerIdMatch = href.match(/playerId=(\d+)/);
        const playerId = playerIdMatch ? playerIdMatch[1] : "";

        if (!playerId) continue;

        const { error } = await supabaseAdmin.from("players").upsert(
          {
            team_slug: team.slug,
            player_id: playerId,
            name,
            role,
            position,
            photo_url: photoUrl,
            profile_url: `https://cricclubs.com${href}`,
          },
          { onConflict: "team_slug,player_id" }
        );
        if (error) {
          console.error(`Player error (${name}):`, error);
          continue;
        }

        // Fetch individual player stats from all leagues
        try {
          const statsUrl = `https://cricclubs.com/NWCL/viewPlayer.do?playerId=${playerId}&clubId=232`;
          const statsRes = await fetch(statsUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            },
          });
          const statsHtml = await statsRes.text();
          const $s = cheerio.load(statsHtml);

          // Collect raw stats from all leagues, then aggregate by format
          const rawBatting: { seriesType: string; matches: number; innings: number; notOuts: number; runs: number; balls: number; highScore: string; hundreds: number; fifties: number; fours: number; sixes: number }[] = [];
          const rawBowling: { seriesType: string; matches: number; innings: number; overs: string; runs: number; wickets: number; bestFigures: string; maidens: number; fourWickets: number; fiveWickets: number; catches: number }[] = [];

          let inLeague = false;
          $s("h2.resp-accordion").each((_, accordion) => {
            const title = $s(accordion).text().trim();
            const titleUpper = title.toUpperCase();

            if (!titleUpper.includes("BATTING") && !titleUpper.includes("BOWLING")) {
              inLeague = true;
              return;
            }
            if (!inLeague) return;

            const content = $s(accordion).next();
            const rows = content.find("table.table tbody tr");

            if (titleUpper.includes("BATTING")) {
              rows.each((_, row) => {
                const cells = $s(row).find("th");
                if (cells.length < 10) return;
                const id = $s(row).attr("id") || "";
                if (id.includes("Grouping") || id.includes("Series")) return;

                const seriesType = $s(cells[0]).find("b").text().trim();
                if (!seriesType) return;

                rawBatting.push({
                  seriesType,
                  matches: parseInt($s(cells[1]).text().trim() || "0"),
                  innings: parseInt($s(cells[2]).text().trim() || "0"),
                  notOuts: parseInt($s(cells[3]).text().trim() || "0"),
                  runs: parseInt($s(cells[4]).text().trim() || "0"),
                  balls: parseInt($s(cells[5]).text().trim() || "0"),
                  highScore: $s(cells[8]).text().trim() || "0",
                  hundreds: parseInt($s(cells[9]).text().trim() || "0"),
                  fifties: parseInt($s(cells[10]).text().trim() || "0"),
                  fours: parseInt($s(cells[13]).text().trim() || "0"),
                  sixes: parseInt($s(cells[14]).text().trim() || "0"),
                });
              });
            } else if (titleUpper.includes("BOWLING")) {
              rows.each((_, row) => {
                const cells = $s(row).find("th");
                if (cells.length < 10) return;
                const id = $s(row).attr("id") || "";
                if (id.includes("Grouping") || id.includes("Series")) return;

                const seriesType = $s(cells[0]).find("b").text().trim();
                if (!seriesType) return;

                rawBowling.push({
                  seriesType,
                  matches: parseInt($s(cells[1]).text().trim() || "0"),
                  innings: parseInt($s(cells[2]).text().trim() || "0"),
                  overs: $s(cells[3]).text().trim() || "0",
                  runs: parseInt($s(cells[4]).text().trim() || "0"),
                  wickets: parseInt($s(cells[5]).text().trim() || "0"),
                  bestFigures: $s(cells[6]).text().trim() || "-",
                  maidens: parseInt($s(cells[7]).text().trim() || "0"),
                  fourWickets: parseInt($s(cells[11]).text().trim() || "0"),
                  fiveWickets: parseInt($s(cells[12]).text().trim() || "0"),
                  catches: parseInt($s(cells[14]).text().trim() || "0"),
                });
              });
            }
          });

          // Aggregate batting by format
          const battingByFormat = new Map<string, typeof rawBatting>();
          for (const r of rawBatting) {
            const existing = battingByFormat.get(r.seriesType) || [];
            existing.push(r);
            battingByFormat.set(r.seriesType, existing);
          }
          for (const [seriesType, stats] of battingByFormat) {
            const matches = stats.reduce((s, r) => s + r.matches, 0);
            const innings = stats.reduce((s, r) => s + r.innings, 0);
            const notOuts = stats.reduce((s, r) => s + r.notOuts, 0);
            const runs = stats.reduce((s, r) => s + r.runs, 0);
            const balls = stats.reduce((s, r) => s + r.balls, 0);
            const dismissals = innings - notOuts;
            const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : "0";
            const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0";
            const highScore = stats.reduce((best, r) => {
              const curr = parseInt(r.highScore) || 0;
              const prev = parseInt(best) || 0;
              return curr > prev ? r.highScore : best;
            }, "0");
            await supabaseAdmin.from("batting_stats").upsert(
              {
                player_id: playerId,
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
                hundreds: stats.reduce((s, r) => s + r.hundreds, 0),
                fifties: stats.reduce((s, r) => s + r.fifties, 0),
                fours: stats.reduce((s, r) => s + r.fours, 0),
                sixes: stats.reduce((s, r) => s + r.sixes, 0),
              },
              { onConflict: "player_id,team_slug,series_type" }
            );
          }

          // Aggregate bowling by format
          const bowlingByFormat = new Map<string, typeof rawBowling>();
          for (const r of rawBowling) {
            const existing = bowlingByFormat.get(r.seriesType) || [];
            existing.push(r);
            bowlingByFormat.set(r.seriesType, existing);
          }
          for (const [seriesType, stats] of bowlingByFormat) {
            const matches = stats.reduce((s, r) => s + r.matches, 0);
            const innings = stats.reduce((s, r) => s + r.innings, 0);
            const totalBalls = stats.reduce((s, r) => {
              const parts = String(r.overs).split(".");
              const full = parseInt(parts[0]) || 0;
              const partial = parseInt(parts[1]) || 0;
              return s + full * 6 + partial;
            }, 0);
            const oversWhole = Math.floor(totalBalls / 6);
            const oversPartial = totalBalls % 6;
            const overs = oversPartial > 0 ? `${oversWhole}.${oversPartial}` : String(oversWhole);
            const runs = stats.reduce((s, r) => s + r.runs, 0);
            const wickets = stats.reduce((s, r) => s + r.wickets, 0);
            const economy = totalBalls > 0 ? (runs / (totalBalls / 6)).toFixed(2) : "0";
            const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0";
            const strikeRate = wickets > 0 ? (totalBalls / wickets).toFixed(2) : "0";
            const bestFigures = stats.reduce((best, r) => {
              if (best === "-") return r.bestFigures;
              const [bw] = best.split("/").map(Number);
              const [sw] = r.bestFigures.split("/").map(Number);
              return (sw || 0) > (bw || 0) ? r.bestFigures : best;
            }, "-");
            await supabaseAdmin.from("bowling_stats").upsert(
              {
                player_id: playerId,
                team_slug: team.slug,
                series_type: seriesType,
                matches,
                innings,
                overs,
                runs,
                wickets,
                best_figures: bestFigures,
                maidens: stats.reduce((s, r) => s + r.maidens, 0),
                average,
                economy,
                strike_rate: strikeRate,
                four_wickets: stats.reduce((s, r) => s + r.fourWickets, 0),
                five_wickets: stats.reduce((s, r) => s + r.fiveWickets, 0),
                catches: stats.reduce((s, r) => s + r.catches, 0),
              },
              { onConflict: "player_id,team_slug,series_type" }
            );
          }
        } catch {
          // Stats fetch failed for this player, continue
        }

        count++;
      }

      results[team.slug] = count;
    } catch (err) {
      console.error(`Failed to fetch players for ${team.slug}:`, err);
      results[team.slug] = 0;
    }
  }

  return NextResponse.json({
    success: true,
    refreshed: results,
    timestamp: new Date().toISOString(),
  });
}
