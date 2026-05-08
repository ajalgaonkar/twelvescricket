import { Team } from "./teams";
import schedulesData from "@/data/schedules.json";

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

interface ScheduleEntry {
  team: string;
  matches: Match[];
  fetchedAt: string;
}

const schedules = schedulesData as Record<string, ScheduleEntry>;

export function getTeamSchedule(team: Team): Match[] {
  const entry = schedules[team.slug];
  if (!entry) return [];
  return entry.matches;
}

export function getScheduleFetchedAt(team: Team): string | null {
  const entry = schedules[team.slug];
  return entry?.fetchedAt || null;
}

export function getAllSchedules(teams: Team[]): Map<string, Match[]> {
  const result = new Map<string, Match[]>();
  for (const team of teams) {
    result.set(team.slug, getTeamSchedule(team));
  }
  return result;
}
