import { getAllPlayers } from "@/lib/players";
import { AllPlayersStats } from "@/components/AllPlayersStats";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "All Players | Twelves Cricket Club",
  description: "Stats for all players across all Twelves Cricket Club teams.",
};

export default async function PlayersPage() {
  const players = await getAllPlayers();

  return (
    <div className="pt-16">
      {/* Header */}
      <section className="relative py-20 px-6 bg-[#081033]">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 max-w-[1280px] mx-auto">
          <Link
            href="/"
            className="text-white/60 hover:text-white text-sm font-[family-name:var(--font-nav)] uppercase tracking-wider transition-colors"
          >
            ← Home
          </Link>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mt-4 font-[family-name:var(--font-heading)]">
            All Players
          </h1>
          <p className="mt-4 text-lg text-white/70 max-w-xl">
            Combined stats across all Twelves Cricket Club teams.
          </p>
          <p className="mt-2 text-sm text-white/50">
            {players.length} players across 4 teams
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-[#0a0a0a] py-14 px-6">
        <div className="max-w-[1280px] mx-auto">
          <AllPlayersStats players={players} />
        </div>
      </section>
    </div>
  );
}
