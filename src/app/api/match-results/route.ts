import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const teamSlug = url.searchParams.get("team");

  if (!teamSlug) {
    return NextResponse.json({ error: "team parameter required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("match_results")
      .select("*")
      .eq("team_slug", teamSlug)
      .order("match_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (data || []).map((r) => ({
      matchId: r.match_id,
      team1Name: r.team1_name,
      team1Score: r.team1_score,
      team1Overs: r.team1_overs,
      team2Name: r.team2_name,
      team2Score: r.team2_score,
      team2Overs: r.team2_overs,
      statusText: r.status_text,
      matchDate: r.match_date,
      scorecardUrl: r.scorecard_url,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
