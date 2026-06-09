import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const team = url.searchParams.get("team");
  const season = url.searchParams.get("season") || "2026";

  try {
    let battingQuery = supabase
      .from("season_batting_stats")
      .select("*")
      .eq("season", parseInt(season))
      .order("runs", { ascending: false });

    let bowlingQuery = supabase
      .from("season_bowling_stats")
      .select("*")
      .eq("season", parseInt(season))
      .order("wickets", { ascending: false });

    if (team) {
      battingQuery = battingQuery.eq("team_slug", team);
      bowlingQuery = bowlingQuery.eq("team_slug", team);
    }

    const [{ data: batting, error: batErr }, { data: bowling, error: bowlErr }] =
      await Promise.all([battingQuery, bowlingQuery]);

    if (batErr || bowlErr) {
      return NextResponse.json(
        { error: (batErr || bowlErr)!.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ batting: batting || [], bowling: bowling || [] });
  } catch {
    return NextResponse.json({ batting: [], bowling: [] }, { status: 500 });
  }
}
