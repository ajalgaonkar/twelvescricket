import { teams } from "@/lib/teams";
import { getAllSchedules } from "@/lib/schedule";
import { MatchCard } from "@/components/MatchCard";
import Link from "next/link";

export const revalidate = 300;

export const metadata = {
  title: "Match Schedule | Twelves Cricket Club",
  description:
    "Full match schedule and results for all Twelves Cricket Club teams in the NWCL.",
};

export default async function SchedulePage() {
  const schedules = await getAllSchedules(teams);

  return (
    <div className="pt-16">
      <section className="bg-[#161616] py-14 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl md:text-[44px] font-bold text-white font-[family-name:var(--font-heading)]">
              Match Schedule
            </h1>
            <hr className="w-[50px] border-t-2 border-[#888] mx-auto mt-4" />
            <p className="text-[#a4a4a4] mt-4">
              Schedules pulled from{" "}
              <a
                href="https://cricclubs.com/NWCL"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:underline"
              >
                CricClubs NWCL
              </a>
            </p>
          </div>

          {teams.map((team) => {
            const matches = schedules.get(team.slug) || [];
            return (
              <section key={team.slug} className="mb-12">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <h2 className="text-2xl font-bold text-white font-[family-name:var(--font-heading)]">
                    <Link
                      href={`/teams/${team.slug}`}
                      className="hover:text-[#a4a4a4] transition-colors"
                    >
                      {team.name}
                    </Link>
                  </h2>
                  <span className="text-sm text-[#888]">
                    ({matches.length} match{matches.length !== 1 ? "es" : ""})
                  </span>
                </div>
                {matches.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {matches.map((match) => (
                      <MatchCard
                        key={match.matchId}
                        match={match}
                        teamColor={team.color}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-[#222] rounded-lg p-6 text-center border border-[#333]">
                    <p className="text-[#888] text-sm">
                      No matches available yet. Check{" "}
                      <a
                        href={`https://cricclubs.com/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white hover:underline"
                      >
                        CricClubs
                      </a>{" "}
                      directly.
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
