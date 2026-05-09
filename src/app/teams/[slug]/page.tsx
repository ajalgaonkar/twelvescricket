import { notFound } from "next/navigation";
import { teams, getTeamBySlug } from "@/lib/teams";
import { getTeamSchedule } from "@/lib/schedule";
import { getTeamPlayers, getPositionLabel } from "@/lib/players";
import { MatchCard } from "@/components/MatchCard";
import Link from "next/link";

export function generateStaticParams() {
  return teams.map((team) => ({ slug: team.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);
  if (!team) return { title: "Team Not Found" };
  return {
    title: `${team.name} | Twelves Cricket Club`,
    description: team.description,
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeamBySlug(slug);
  if (!team) notFound();

  const matches = getTeamSchedule(team);
  const players = getTeamPlayers(team.slug);
  const otherTeams = teams.filter((t) => t.slug !== team.slug);

  const captain = players.find((p) => p.position === "C");
  const viceCaptain = players.find((p) => p.position === "VC");
  const wicketKeeper = players.find(
    (p) => p.position === "WK" || p.role === "Wicket Keeper"
  );

  return (
    <div className="pt-16">
      {/* Team Header */}
      <section
        className="relative py-20 px-6"
        style={{ backgroundColor: team.color }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-[1280px] mx-auto">
          <Link
            href="/"
            className="text-white/60 hover:text-white text-sm font-[family-name:var(--font-nav)] uppercase tracking-wider transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mt-4 font-[family-name:var(--font-heading)]">
            {team.name}
          </h1>
          <p className="mt-4 text-lg text-white/70 max-w-xl">
            {team.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/60">
            {captain && <span>Captain: {captain.name}</span>}
            {viceCaptain && <span>Vice Captain: {viceCaptain.name}</span>}
            {wicketKeeper && wicketKeeper !== captain && wicketKeeper !== viceCaptain && (
              <span>Keeper: {wicketKeeper.name}</span>
            )}
          </div>
          <a
            href={`https://cricclubs.com/NWCL/viewTeam.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center text-sm text-white/50 hover:text-white transition-colors"
          >
            View on CricClubs →
          </a>
        </div>
      </section>

      {/* Players Section */}
      <section className="bg-[#0a0a0a] py-14 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-heading)]">
              Squad
            </h2>
            <hr className="w-[50px] border-t-2 border-[#888] mx-auto mt-4" />
            <p className="text-[#888] mt-3 text-sm">
              {players.length} player{players.length !== 1 ? "s" : ""}
            </p>
          </div>
          {players.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {players.map((player) => (
                <div
                  key={player.playerId || player.name}
                  className="bg-[#161616] rounded-lg border border-[#333] overflow-hidden hover:border-[#555] transition-colors"
                >
                  {/* Player photo */}
                  {player.photoUrl && (
                    <div className="h-48 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={player.photoUrl}
                        alt={player.name}
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-white font-semibold text-sm">
                        {player.name}
                      </h3>
                      {player.position && (
                        <span
                          className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: team.color,
                            color: "white",
                          }}
                        >
                          {getPositionLabel(player.position)}
                        </span>
                      )}
                    </div>
                    <p className="text-[#888] text-xs mt-1">{player.role}</p>

                    {/* Quick stats */}
                    {(player.batting.length > 0 || player.bowling.length > 0) && (
                      <div className="mt-3 pt-3 border-t border-[#333]">
                        {player.batting.length > 0 && (
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#888]">Batting</span>
                            <span className="text-[#a4a4a4]">
                              {player.batting[0].runs}r | Avg{" "}
                              {player.batting[0].average} | SR{" "}
                              {player.batting[0].strikeRate}
                            </span>
                          </div>
                        )}
                        {player.bowling.length > 0 &&
                          player.bowling[0].wickets > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-[#888]">Bowling</span>
                              <span className="text-[#a4a4a4]">
                                {player.bowling[0].wickets}w | Econ{" "}
                                {player.bowling[0].economy} | Best{" "}
                                {player.bowling[0].bestFigures}
                              </span>
                            </div>
                          )}
                      </div>
                    )}

                    <a
                      href={player.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs text-[#888] hover:text-white transition-colors"
                    >
                      Full Profile →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#222] rounded-lg p-8 text-center border border-[#333]">
              <p className="text-[#a4a4a4]">
                Squad not yet announced.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Schedule */}
      <section className="bg-[#161616] py-14 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-heading)]">
              Match Schedule
            </h2>
            <hr className="w-[50px] border-t-2 border-[#888] mx-auto mt-4" />
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
            <div className="bg-[#222] rounded-lg p-8 text-center border border-[#333]">
              <p className="text-[#a4a4a4]">
                No matches found. Check{" "}
                <a
                  href={`https://cricclubs.com/NWCL/teamSchedule.do?teamId=${team.teamId}&league=${team.leagueId}&clubId=${team.clubId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:underline"
                >
                  CricClubs
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Other Teams */}
      <section className="bg-black py-14 px-6 border-t border-[#333]">
        <div className="max-w-[1280px] mx-auto">
          <h3 className="text-xl font-bold text-white font-[family-name:var(--font-heading)] mb-6 text-center">
            Other Teams
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {otherTeams.map((t) => (
              <Link
                key={t.slug}
                href={`/teams/${t.slug}`}
                className="px-5 py-2 rounded border border-[#444] hover:border-white transition-colors text-sm font-[family-name:var(--font-nav)] font-semibold uppercase tracking-wider text-[#a4a4a4] hover:text-white"
              >
                {t.shortName}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
