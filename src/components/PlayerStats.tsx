"use client";

import { useState } from "react";
import { Player } from "@/lib/players";

interface PlayerStatsProps {
  players: Player[];
  teamColor: string;
}

export function PlayerStats({ players, teamColor }: PlayerStatsProps) {
  const [view, setView] = useState<"batting" | "bowling">("batting");

  const sortedBatting = [...players]
    .filter((p) => p.batting.length > 0 && p.batting[0].runs > 0)
    .sort((a, b) => b.batting[0].runs - a.batting[0].runs);

  const sortedBowling = [...players]
    .filter((p) => p.bowling.length > 0 && p.bowling[0].wickets > 0)
    .sort((a, b) => b.bowling[0].wickets - a.bowling[0].wickets);

  const topBatter = sortedBatting[0];
  const topBowler = sortedBowling[0];
  const hero = view === "batting" ? topBatter : topBowler;
  const sortedPlayers = view === "batting" ? sortedBatting : sortedBowling;

  return (
    <div>
      {/* Batting / Bowling Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setView("batting")}
          className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider rounded transition-colors ${
            view === "batting"
              ? "text-white"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
          style={view === "batting" ? { backgroundColor: teamColor } : undefined}
        >
          Batting
        </button>
        <button
          onClick={() => setView("bowling")}
          className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider rounded transition-colors ${
            view === "bowling"
              ? "text-white"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
          style={view === "bowling" ? { backgroundColor: teamColor } : undefined}
        >
          Bowling
        </button>
      </div>

      {/* Hero Banner for #1 */}
      {hero && (
        <div className="relative bg-black rounded-2xl overflow-hidden mb-6">
          <div className="absolute inset-0 opacity-20 bg-gradient-to-t from-black via-transparent to-transparent" />
          <div className="relative flex flex-col md:flex-row items-center p-6 md:p-8 gap-6">
            {/* Player Image */}
            <div className="relative shrink-0">
              {hero.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hero.photoUrl}
                  alt={hero.name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover object-top border-4"
                  style={{ borderColor: teamColor }}
                />
              )}
              <span className="absolute -bottom-2 -right-2 text-7xl font-extrabold text-white/10 select-none">
                1
              </span>
            </div>

            {/* Player Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <h3 className="text-2xl md:text-3xl font-bold text-white uppercase">
                  {hero.name}
                </h3>
                {hero.position && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-white"
                    style={{ backgroundColor: teamColor }}
                  >
                    {hero.position === "C" ? "Captain" : hero.position === "VC" ? "Vice Captain" : hero.position}
                  </span>
                )}
              </div>
              <p className="text-white/60 text-sm mt-1">{hero.role}</p>

              {/* Stat Boxes */}
              <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-0 border border-white/20 rounded-lg overflow-hidden w-fit mx-auto md:mx-0">
                {view === "batting" && hero.batting[0] && (
                  <>
                    <StatBox label="Runs" value={String(hero.batting[0].runs)} />
                    <StatBox label="Matches" value={String(hero.batting[0].matches)} />
                    <StatBox label="Average" value={hero.batting[0].average} />
                    <StatBox label="SR" value={hero.batting[0].strikeRate} />
                    <StatBox label="HS" value={hero.batting[0].highScore} />
                    <StatBox label="50s" value={String(hero.batting[0].fifties)} last />
                  </>
                )}
                {view === "bowling" && hero.bowling[0] && (
                  <>
                    <StatBox label="Wickets" value={String(hero.bowling[0].wickets)} />
                    <StatBox label="Matches" value={String(hero.bowling[0].matches)} />
                    <StatBox label="Economy" value={hero.bowling[0].economy} />
                    <StatBox label="Best" value={hero.bowling[0].bestFigures} />
                    <StatBox label="Overs" value={hero.bowling[0].overs} />
                    <StatBox label="SR" value={hero.bowling[0].strikeRate} last />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Table */}
      {sortedPlayers.length > 1 && (
        <div className="rounded-2xl overflow-hidden border border-[#333]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#081033] text-white">
                  <th className="px-3 py-3 text-center font-normal tracking-wide w-12">
                    #
                  </th>
                  <th className="px-3 py-3 text-left font-normal tracking-wide">
                    Player
                  </th>
                  {view === "batting" ? (
                    <>
                      <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">
                        Runs
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Mat
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Inns
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Avg
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        SR
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        HS
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        50s
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        4s
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        6s
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">
                        Wkts
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Mat
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Inns
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Overs
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Econ
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Best
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Avg
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        SR
                      </th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">
                        Catches
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-[#fafbfc]">
                {sortedPlayers.slice(1).map((player, idx) => (
                  <tr
                    key={player.playerId || player.name}
                    className="border-b border-[#d9d9d9] hover:bg-[#f0f0f0] transition-colors"
                  >
                    <td className="px-3 py-2 text-center text-lg text-black font-normal">
                      {idx + 2}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {player.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.photoUrl}
                            alt={player.name}
                            className="w-10 h-10 rounded-full object-cover object-top shrink-0"
                          />
                        )}
                        <div>
                          <a
                            href={player.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#11141c] hover:underline"
                          >
                            {player.name}
                          </a>
                          <p className="text-xs text-black/50">{player.role}</p>
                        </div>
                        {player.position && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#081033] text-white ml-1">
                            {player.position}
                          </span>
                        )}
                      </div>
                    </td>
                    {view === "batting" && player.batting[0] && (
                      <>
                        <td className="px-3 py-2 text-center font-bold text-black bg-black/5">
                          {player.batting[0].runs}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].matches}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].innings}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].average}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].strikeRate}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].highScore}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].fifties}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].fours}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.batting[0].sixes}
                        </td>
                      </>
                    )}
                    {view === "bowling" && player.bowling[0] && (
                      <>
                        <td className="px-3 py-2 text-center font-bold text-black bg-black/5">
                          {player.bowling[0].wickets}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].matches}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].innings}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].overs}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].economy}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].bestFigures}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].average}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].strikeRate}
                        </td>
                        <td className="px-3 py-2 text-center text-black/70">
                          {player.bowling[0].catches}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sortedPlayers.length === 0 && (
        <div className="bg-[#222] rounded-lg p-8 text-center border border-[#333]">
          <p className="text-[#a4a4a4]">
            No {view} stats available yet.
          </p>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-3 md:px-6 md:py-4 ${
        !last ? "border-r border-white/20" : ""
      }`}
    >
      <span className="text-white text-lg md:text-xl font-bold">{value}</span>
      <span className="text-white/60 text-[10px] md:text-xs capitalize mt-0.5">
        {label}
      </span>
    </div>
  );
}
