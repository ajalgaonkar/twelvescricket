import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MatchCenterItem {
  matchId: string;
  team1: string;
  team2: string;
  date: string | null;
  time: string | null;
  matchType: string | null;
  ground: string | null;
  result: string | null;
  scorecardUrl: string;
  teamSlug: string;
  teamColor: string;
  status: "live" | "completed" | "upcoming";
  liveData: {
    team1Score: string;
    team1Overs: string;
    team2Score: string;
    team2Overs: string;
    statusText: string;
    battingNow: { name: string; runs: string; balls: string; fours: string; sixes: string; sr: string }[];
    bowlingNow: { name: string; overs: string; maidens: string; runs: string; wickets: string; econ: string }[];
  } | null;
}

const teamColors: Record<string, string> = {
  copters: "#1e40af",
  drones: "#059669",
  jets: "#dc2626",
  rockets: "#7c3aed",
};

export async function GET() {
  try {
    const results: MatchCenterItem[] = [];

    // 1. Get live scores from live_scores table (populated by scraper)
    try {
      const { data: liveScores } = await supabase
        .from("live_scores")
        .select("*")
        .order("updated_at", { ascending: false });

      if (liveScores && liveScores.length > 0) {
        for (const ls of liveScores) {
          const statusText = (ls.status_text || "").toLowerCase();
          const isLive = ls.is_live;
          const isCompleted =
            statusText.includes("won") ||
            statusText.includes("tied") ||
            statusText.includes("draw") ||
            statusText.includes("no result");

          results.push({
            matchId: ls.match_id,
            team1: ls.team1_name || "",
            team2: ls.team2_name || "",
            date: null,
            time: null,
            matchType: null,
            ground: null,
            result: isCompleted ? ls.status_text : null,
            scorecardUrl: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${ls.match_id}&clubId=232`,
            teamSlug: ls.team_slug,
            teamColor: teamColors[ls.team_slug] || "#666",
            status: isLive ? "live" : isCompleted ? "completed" : "upcoming",
            liveData: {
              team1Score: ls.team1_score || "",
              team1Overs: ls.team1_overs || "",
              team2Score: ls.team2_score || "",
              team2Overs: ls.team2_overs || "",
              statusText: ls.status_text || "",
              battingNow: ls.batting_now || [],
              bowlingNow: ls.bowling_now || [],
            },
          });
        }
      }
    } catch {
      // live_scores table may not exist yet
    }

    // 2. Get upcoming matches from the matches table
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .order("date", { ascending: true });

    if (matches) {
      // Parse today for comparison
      const now = new Date();
      const todayStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;

      const upcoming = matches.filter((m) => {
        if (!m.date) return false;
        return m.date >= todayStr && !m.result;
      });

      for (const m of upcoming.slice(0, 6)) {
        results.push({
          matchId: m.match_id,
          team1: m.team1,
          team2: m.team2,
          date: m.date,
          time: m.time,
          matchType: m.match_type,
          ground: m.ground,
          result: null,
          scorecardUrl: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${m.match_id}&clubId=232`,
          teamSlug: m.team_slug,
          teamColor: teamColors[m.team_slug] || "#666",
          status: "upcoming",
          liveData: null,
        });
      }
    }

    // Sort: live first, then upcoming, then completed
    results.sort((a, b) => {
      const order = { live: 0, upcoming: 1, completed: 2 };
      return order[a.status] - order[b.status];
    });

    return NextResponse.json({ matches: results.slice(0, 8) });
  } catch {
    return NextResponse.json({ matches: [] }, { status: 500 });
  }
}
