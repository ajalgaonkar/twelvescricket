import { NextRequest } from "next/server";
import { teams, getTeamBySlug } from "@/lib/teams";
import { getTeamSchedule, getScheduleFetchedAt } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("team");

  if (slug) {
    const team = getTeamBySlug(slug);
    if (!team) {
      return Response.json({ error: "Team not found" }, { status: 404 });
    }
    const matches = getTeamSchedule(team);
    const fetchedAt = getScheduleFetchedAt(team);
    return Response.json({ team: team.name, matches, fetchedAt });
  }

  const results: Record<string, unknown> = {};
  for (const team of teams) {
    const matches = getTeamSchedule(team);
    const fetchedAt = getScheduleFetchedAt(team);
    results[team.slug] = { team: team.name, matches, fetchedAt };
  }

  return Response.json(results);
}
