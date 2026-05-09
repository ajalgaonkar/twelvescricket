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
      const url = `https://cricclubs.com/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      const html = await res.text();
      const $ = cheerio.load(html);

      const matches: {
        team_slug: string;
        match_id: string;
        date: string | null;
        time: string | null;
        match_type: string | null;
        series: string | null;
        division: string | null;
        team1: string;
        team2: string;
        ground: string | null;
        result: string | null;
        scorecard_url: string | null;
      }[] = [];

      $("#attTable tbody tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 9) return;

        const matchId = $(cells[0]).text().trim();
        if (!matchId || matchId === "#") return;

        matches.push({
          team_slug: team.slug,
          match_id: matchId,
          series: $(cells[1]).text().trim() || null,
          division: $(cells[2]).text().trim() || null,
          match_type: $(cells[3]).text().trim() || null,
          date: $(cells[4]).text().trim() || null,
          time: $(cells[5]).text().trim() || null,
          team1: $(cells[6]).text().trim(),
          team2: $(cells[7]).text().trim(),
          ground: $(cells[8]).text().trim() || null,
          result: null,
          scorecard_url: null,
        });
      });

      if (matches.length > 0) {
        const { error } = await supabaseAdmin
          .from("matches")
          .upsert(matches, { onConflict: "team_slug,match_id" });
        if (error) console.error(`Schedule error for ${team.slug}:`, error);
      }

      results[team.slug] = matches.length;
    } catch (err) {
      console.error(`Failed to fetch schedule for ${team.slug}:`, err);
      results[team.slug] = 0;
    }
  }

  return NextResponse.json({
    success: true,
    refreshed: results,
    timestamp: new Date().toISOString(),
  });
}
