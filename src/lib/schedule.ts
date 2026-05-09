import { supabase } from "./supabase";
import { Team } from "./teams";

export interface Match {
  matchId: string;
  date: string;
  time: string;
  matchType: string;
  series?: string;
  division?: string;
  team1: string;
  team2: string;
  ground: string;
  result: string | null;
  scorecardUrl: string | null;
}

export async function getTeamSchedule(team: Team): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("team_slug", team.slug)
    .order("date", { ascending: true });

  if (error || !data) return [];

  return data.map((m) => ({
    matchId: m.match_id,
    date: m.date,
    time: m.time,
    matchType: m.match_type,
    series: m.series,
    division: m.division,
    team1: m.team1,
    team2: m.team2,
    ground: m.ground,
    result: m.result,
    scorecardUrl: m.scorecard_url,
  }));
}

export async function getAllSchedules(
  teams: Team[]
): Promise<Map<string, Match[]>> {
  const map = new Map<string, Match[]>();
  for (const team of teams) {
    const matches = await getTeamSchedule(team);
    map.set(team.slug, matches);
  }
  return map;
}
