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

        // Fetch individual player stats
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

          let inNWCL = false;
          $s("h2.resp-accordion").each((_, accordion) => {
            const title = $s(accordion).text().trim();
            const titleUpper = title.toUpperCase();

            if (!titleUpper.includes("BATTING") && !titleUpper.includes("BOWLING")) {
              inNWCL = titleUpper.includes("NORTHWEST CRICKET LEAGUE");
              return;
            }
            if (!inNWCL) return;

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

                supabaseAdmin.from("batting_stats").upsert(
                  {
                    player_id: playerId,
                    team_slug: team.slug,
                    series_type: seriesType,
                    matches: parseInt($s(cells[1]).text().trim() || "0"),
                    innings: parseInt($s(cells[2]).text().trim() || "0"),
                    not_outs: parseInt($s(cells[3]).text().trim() || "0"),
                    runs: parseInt($s(cells[4]).text().trim() || "0"),
                    balls: parseInt($s(cells[5]).text().trim() || "0"),
                    average: $s(cells[6]).text().trim() || "0",
                    strike_rate: $s(cells[7]).text().trim() || "0",
                    high_score: $s(cells[8]).text().trim() || "0",
                    hundreds: parseInt($s(cells[9]).text().trim() || "0"),
                    fifties: parseInt($s(cells[10]).text().trim() || "0"),
                    fours: parseInt($s(cells[13]).text().trim() || "0"),
                    sixes: parseInt($s(cells[14]).text().trim() || "0"),
                  },
                  { onConflict: "player_id,team_slug,series_type" }
                );
              });
            } else if (titleUpper.includes("BOWLING")) {
              rows.each((_, row) => {
                const cells = $s(row).find("th");
                if (cells.length < 10) return;
                const id = $s(row).attr("id") || "";
                if (id.includes("Grouping") || id.includes("Series")) return;

                const seriesType = $s(cells[0]).find("b").text().trim();
                if (!seriesType) return;

                supabaseAdmin.from("bowling_stats").upsert(
                  {
                    player_id: playerId,
                    team_slug: team.slug,
                    series_type: seriesType,
                    matches: parseInt($s(cells[1]).text().trim() || "0"),
                    innings: parseInt($s(cells[2]).text().trim() || "0"),
                    overs: $s(cells[3]).text().trim() || "0",
                    runs: parseInt($s(cells[4]).text().trim() || "0"),
                    wickets: parseInt($s(cells[5]).text().trim() || "0"),
                    best_figures: $s(cells[6]).text().trim() || "-",
                    maidens: parseInt($s(cells[7]).text().trim() || "0"),
                    average: $s(cells[8]).text().trim() || "0",
                    economy: $s(cells[9]).text().trim() || "0",
                    strike_rate: $s(cells[10]).text().trim() || "0",
                    four_wickets: parseInt($s(cells[11]).text().trim() || "0"),
                    five_wickets: parseInt($s(cells[12]).text().trim() || "0"),
                    catches: parseInt($s(cells[14]).text().trim() || "0"),
                  },
                  { onConflict: "player_id,team_slug,series_type" }
                );
              });
            }
          });
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
