import { notFound } from "next/navigation";
import { teams, getTeamBySlug } from "@/lib/teams";
import { getTeamSchedule } from "@/lib/schedule";
import { getTeamPlayers } from "@/lib/players";
import { MatchCard } from "@/components/MatchCard";
import { PlayerStats } from "@/components/PlayerStats";
import { TeamGameCenter } from "@/components/TeamGameCenter";
import Link from "next/link";

export const revalidate = 300;

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

  const matches = await getTeamSchedule(team);
  const players = await getTeamPlayers(team.slug);
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

      {/* Game Center */}
      <section className="bg-[#0a0a0a] py-14 px-6 border-b border-[#222]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-heading)]">
              Game Center
            </h2>
            <hr className="w-[50px] border-t-2 border-[#888] mx-auto mt-4" />
            <p className="text-[#888] mt-3 text-sm">
              Results from the current season
            </p>
          </div>
          <TeamGameCenter teamSlug={team.slug} teamColor={team.color} />
        </div>
      </section>

      {/* Player Stats Section */}
      <section className="bg-[#0a0a0a] py-14 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-[family-name:var(--font-heading)]">
              Player Stats
            </h2>
            <hr className="w-[50px] border-t-2 border-[#888] mx-auto mt-4" />
            <p className="text-[#888] mt-3 text-sm">
              {players.length} player{players.length !== 1 ? "s" : ""}
            </p>
          </div>
          <PlayerStats players={players} teamColor={team.color} />
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
