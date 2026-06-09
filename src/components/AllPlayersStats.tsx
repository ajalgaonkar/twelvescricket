"use client";

import { useState, useMemo, useEffect } from "react";
import { PlayerWithTeam, BattingStats, BowlingStats } from "@/lib/players";

interface SeasonBatting {
  player_id: string;
  player_name: string;
  team_slug: string;
  matches: number;
  innings: number;
  not_outs: number;
  runs: number;
  balls: number;
  high_score: string;
  average: string;
  strike_rate: string;
  hundreds: number;
  fifties: number;
  fours: number;
  sixes: number;
}

interface SeasonBowling {
  player_id: string;
  player_name: string;
  team_slug: string;
  matches: number;
  innings: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  best_figures: string;
  average: string;
  economy: string;
  strike_rate: string;
  four_wickets: number;
  five_wickets: number;
}

interface AllPlayersStatsProps {
  players: PlayerWithTeam[];
}

const FORMAT_TABS = ["COMBINED", "1 DAY", "T20", "OTHER"] as const;
type Format = (typeof FORMAT_TABS)[number];

function combineBatting(stats: BattingStats[]): BattingStats | null {
  if (stats.length === 0) return null;
  const matches = stats.reduce((sum, s) => sum + s.matches, 0);
  const innings = stats.reduce((sum, s) => sum + s.innings, 0);
  const notOuts = stats.reduce((sum, s) => sum + s.notOuts, 0);
  const runs = stats.reduce((sum, s) => sum + s.runs, 0);
  const balls = stats.reduce((sum, s) => sum + s.balls, 0);
  const fifties = stats.reduce((sum, s) => sum + s.fifties, 0);
  const hundreds = stats.reduce((sum, s) => sum + s.hundreds, 0);
  const fours = stats.reduce((sum, s) => sum + s.fours, 0);
  const sixes = stats.reduce((sum, s) => sum + s.sixes, 0);
  const dismissals = innings - notOuts;
  const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : "0";
  const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0";
  const highScore = stats.reduce((best, s) => {
    const curr = parseInt(s.highScore) || 0;
    const prev = parseInt(best) || 0;
    return curr > prev ? s.highScore : best;
  }, "0");
  return {
    seriesType: "COMBINED",
    matches,
    innings,
    notOuts,
    runs,
    balls,
    average,
    strikeRate,
    highScore,
    hundreds,
    fifties,
    fours,
    sixes,
  };
}

function combineBowling(stats: BowlingStats[]): BowlingStats | null {
  if (stats.length === 0) return null;
  const matches = stats.reduce((sum, s) => sum + s.matches, 0);
  const innings = stats.reduce((sum, s) => sum + s.innings, 0);
  const totalOvers = stats.reduce((sum, s) => {
    const parts = String(s.overs).split(".");
    const full = parseInt(parts[0]) || 0;
    const partial = parseInt(parts[1]) || 0;
    return sum + full * 6 + partial;
  }, 0);
  const oversWhole = Math.floor(totalOvers / 6);
  const oversPartial = totalOvers % 6;
  const overs = oversPartial > 0 ? `${oversWhole}.${oversPartial}` : String(oversWhole);
  const runs = stats.reduce((sum, s) => sum + s.runs, 0);
  const wickets = stats.reduce((sum, s) => sum + s.wickets, 0);
  const maidens = stats.reduce((sum, s) => sum + s.maidens, 0);
  const fourWickets = stats.reduce((sum, s) => sum + s.fourWickets, 0);
  const fiveWickets = stats.reduce((sum, s) => sum + s.fiveWickets, 0);
  const catches = stats.reduce((sum, s) => sum + s.catches, 0);
  const economy = totalOvers > 0 ? (runs / (totalOvers / 6)).toFixed(2) : "0";
  const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0";
  const strikeRate = wickets > 0 ? ((totalOvers / 6) * 6 / wickets).toFixed(2) : "0";
  const bestFigures = stats.reduce((best, s) => {
    const [bw] = best.split("/").map(Number);
    const [sw] = s.bestFigures.split("/").map(Number);
    return (sw || 0) > (bw || 0) ? s.bestFigures : best;
  }, "-");
  return {
    seriesType: "COMBINED",
    matches,
    innings,
    overs,
    runs,
    wickets,
    bestFigures,
    maidens,
    average,
    economy,
    strikeRate,
    fourWickets,
    fiveWickets,
    catches,
  };
}

export function AllPlayersStats({ players }: AllPlayersStatsProps) {
  const [format, setFormat] = useState<Format>("COMBINED");
  const [view, setView] = useState<"batting" | "bowling">("batting");
  const [search, setSearch] = useState("");
  const [era, setEra] = useState<"alltime" | "2026">("alltime");
  const [seasonBatting, setSeasonBatting] = useState<SeasonBatting[]>([]);
  const [seasonBowling, setSeasonBowling] = useState<SeasonBowling[]>([]);
  const [seasonLoading, setSeasonLoading] = useState(false);

  useEffect(() => {
    if (era === "2026") {
      setSeasonLoading(true);
      fetch("/api/season-stats?season=2026")
        .then((r) => r.json())
        .then((data) => {
          setSeasonBatting(data.batting || []);
          setSeasonBowling(data.bowling || []);
        })
        .catch(() => {})
        .finally(() => setSeasonLoading(false));
    }
  }, [era]);

  const getBatting = (p: PlayerWithTeam): BattingStats | null => {
    if (format === "COMBINED") return combineBatting(p.batting);
    return p.batting.find((b) => b.seriesType === format) || null;
  };

  const getBowling = (p: PlayerWithTeam): BowlingStats | null => {
    if (format === "COMBINED") return combineBowling(p.bowling);
    return p.bowling.find((b) => b.seriesType === format) || null;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q));
  }, [players, search]);

  const sortedBatting = useMemo(
    () =>
      [...filtered]
        .filter((p) => {
          const b = getBatting(p);
          return b && b.runs > 0;
        })
        .sort((a, b) => getBatting(b)!.runs - getBatting(a)!.runs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, format]
  );

  const sortedBowling = useMemo(
    () =>
      [...filtered]
        .filter((p) => {
          const b = getBowling(p);
          return b && b.wickets > 0;
        })
        .sort((a, b) => getBowling(b)!.wickets - getBowling(a)!.wickets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, format]
  );

  const sortedPlayers = view === "batting" ? sortedBatting : sortedBowling;
  const hero = sortedPlayers[0];

  const filteredSeasonBatting = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return seasonBatting;
    return seasonBatting.filter((s) => s.player_name.toLowerCase().includes(q));
  }, [seasonBatting, search]);

  const filteredSeasonBowling = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return seasonBowling;
    return seasonBowling.filter((s) => s.player_name.toLowerCase().includes(q));
  }, [seasonBowling, search]);

  return (
    <div>
      {/* Era Toggle */}
      <div className="flex justify-center gap-2 mb-4">
        <button
          onClick={() => setEra("alltime")}
          className={`px-5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
            era === "alltime"
              ? "bg-white text-black"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
        >
          All Time
        </button>
        <button
          onClick={() => setEra("2026")}
          className={`px-5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
            era === "2026"
              ? "bg-white text-black"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
        >
          2026 Season
        </button>
      </div>

      {/* Format Tabs (only for all-time) */}
      {era === "alltime" && (
        <div className="flex justify-center gap-2 mb-6">
          {FORMAT_TABS.map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-5 py-2 text-sm font-semibold uppercase tracking-wider rounded transition-colors ${
                format === f
                  ? "bg-[#081033] text-white"
                  : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
              }`}
            >
              {f === "OTHER" ? "Other" : f === "COMBINED" ? "All Formats" : f}
            </button>
          ))}
        </div>
      )}

      {/* Batting / Bowling Tabs */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setView("batting")}
          className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider rounded transition-colors ${
            view === "batting"
              ? "bg-white text-black"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
        >
          Batting
        </button>
        <button
          onClick={() => setView("bowling")}
          className={`px-6 py-2 text-sm font-semibold uppercase tracking-wider rounded transition-colors ${
            view === "bowling"
              ? "bg-white text-black"
              : "bg-transparent border border-[#444] text-[#a4a4a4] hover:text-white hover:border-white"
          }`}
        >
          Bowling
        </button>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto mb-8">
        <input
          type="text"
          placeholder="Search player name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-lg bg-[#1a1a1a] border border-[#333] text-white placeholder-[#666] focus:outline-none focus:border-[#555] transition-colors text-sm"
        />
      </div>

      {/* Season Stats View */}
      {era === "2026" && (
        <>
          {seasonLoading ? (
            <div className="bg-[#222] rounded-lg p-8 text-center border border-[#333]">
              <p className="text-[#a4a4a4]">Loading 2026 season stats...</p>
            </div>
          ) : (
            <AllSeasonStatsTable
              batting={filteredSeasonBatting}
              bowling={filteredSeasonBowling}
              view={view}
            />
          )}
        </>
      )}

      {/* All-Time Stats View */}
      {era === "alltime" && (
        <>
          {/* Hero Banner for #1 */}
          {hero && (
            <div className="relative bg-black rounded-2xl overflow-hidden mb-6">
              <div className="absolute inset-0 opacity-20 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="relative flex flex-col md:flex-row items-center p-6 md:p-8 gap-6">
                <div className="relative shrink-0">
                  {hero.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={hero.photoUrl}
                      alt={hero.name}
                      className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover object-top border-4"
                      style={{ borderColor: hero.teamColor }}
                    />
                  )}
                  <span className="absolute -bottom-2 -right-2 text-7xl font-extrabold text-white/10 select-none">
                    1
                  </span>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3">
                    <h3 className="text-2xl md:text-3xl font-bold text-white uppercase">
                      {hero.name}
                    </h3>
                    {hero.teams.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-white"
                        style={{ backgroundColor: hero.teamColor }}
                      >
                        {t}
                      </span>
                    ))}
                    {hero.position && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-white/20 text-white">
                        {hero.position === "C"
                          ? "Captain"
                          : hero.position === "VC"
                            ? "Vice Captain"
                            : hero.position}
                      </span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm mt-1">{hero.role}</p>

                  <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-0 border border-white/20 rounded-lg overflow-hidden w-fit mx-auto md:mx-0">
                    {view === "batting" &&
                      getBatting(hero) &&
                      (() => {
                        const s = getBatting(hero)!;
                        return (
                          <>
                            <StatBox label="Runs" value={String(s.runs)} />
                            <StatBox label="Matches" value={String(s.matches)} />
                            <StatBox label="Average" value={s.average} />
                            <StatBox label="SR" value={s.strikeRate} />
                            <StatBox label="HS" value={s.highScore} />
                            <StatBox label="50s" value={String(s.fifties)} last />
                          </>
                        );
                      })()}
                    {view === "bowling" &&
                      getBowling(hero) &&
                      (() => {
                        const s = getBowling(hero)!;
                        return (
                          <>
                            <StatBox label="Wickets" value={String(s.wickets)} />
                            <StatBox label="Matches" value={String(s.matches)} />
                            <StatBox label="Economy" value={s.economy} />
                            <StatBox label="Best" value={s.bestFigures} />
                            <StatBox label="Overs" value={s.overs} />
                            <StatBox label="SR" value={s.strikeRate} last />
                          </>
                        );
                      })()}
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
                      <th className="px-3 py-3 text-center font-normal tracking-wide w-12">#</th>
                      <th className="px-3 py-3 text-left font-normal tracking-wide">Player</th>
                      <th className="px-3 py-3 text-left font-normal tracking-wide">Team</th>
                      {view === "batting" ? (
                        <>
                          <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">Runs</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Mat</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Inns</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Avg</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">SR</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">HS</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">50s</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">4s</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">6s</th>
                        </>
                      ) : (
                        <>
                          <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">Wkts</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Mat</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Inns</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Overs</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Econ</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Best</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Avg</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">SR</th>
                          <th className="px-3 py-3 text-center font-normal tracking-wide">Catches</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-[#fafbfc]">
                    {sortedPlayers.slice(1).map((player, idx) => (
                      <tr
                        key={`${player.teamSlug}-${player.playerId}`}
                        className="border-b border-[#d9d9d9] hover:bg-[#f0f0f0] transition-colors"
                      >
                        <td className="px-3 py-2 text-center text-lg text-black font-normal">{idx + 2}</td>
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
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {player.teams.map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded text-white"
                                style={{ backgroundColor: player.teamColor }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        {view === "batting" &&
                          (() => {
                            const s = getBatting(player);
                            if (!s) return null;
                            return (
                              <>
                                <td className="px-3 py-2 text-center font-bold text-black bg-black/5">{s.runs}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.matches}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.innings}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.average}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.strikeRate}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.highScore}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.fifties}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.fours}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.sixes}</td>
                              </>
                            );
                          })()}
                        {view === "bowling" &&
                          (() => {
                            const s = getBowling(player);
                            if (!s) return null;
                            return (
                              <>
                                <td className="px-3 py-2 text-center font-bold text-black bg-black/5">{s.wickets}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.matches}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.innings}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.overs}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.economy}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.bestFigures}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.average}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.strikeRate}</td>
                                <td className="px-3 py-2 text-center text-black/70">{s.catches}</td>
                              </>
                            );
                          })()}
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
                No {view} stats available for {format === "COMBINED" ? "All Formats" : format}
                {search ? ` matching "${search}"` : ""}.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AllSeasonStatsTable({
  batting,
  bowling,
  view,
}: {
  batting: SeasonBatting[];
  bowling: SeasonBowling[];
  view: "batting" | "bowling";
}) {
  const data = view === "batting" ? batting : bowling;

  if (data.length === 0) {
    return (
      <div className="bg-[#222] rounded-lg p-8 text-center border border-[#333]">
        <p className="text-[#a4a4a4]">No 2026 {view} stats available yet.</p>
      </div>
    );
  }

  const topRecord = data[0];

  return (
    <>
      {/* Season Hero */}
      <div className="relative bg-black rounded-2xl overflow-hidden mb-6">
        <div className="relative flex flex-col md:flex-row items-center p-6 md:p-8 gap-6">
          <div className="relative shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/30 flex items-center justify-center bg-[#111]">
              <span className="text-4xl font-bold text-white">
                {topRecord.player_name.split(" ").map((n) => n[0]).join("")}
              </span>
            </div>
            <span className="absolute -bottom-2 -right-2 text-7xl font-extrabold text-white/10 select-none">
              1
            </span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-bold text-white uppercase">
              {topRecord.player_name}
            </h3>
            <p className="text-white/60 text-sm mt-1">
              2026 Season Leader &middot; {topRecord.team_slug.charAt(0).toUpperCase() + topRecord.team_slug.slice(1)}
            </p>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-0 border border-white/20 rounded-lg overflow-hidden w-fit mx-auto md:mx-0">
              {view === "batting" && (() => {
                const s = topRecord as SeasonBatting;
                return (
                  <>
                    <StatBox label="Runs" value={String(s.runs)} />
                    <StatBox label="Matches" value={String(s.matches)} />
                    <StatBox label="Average" value={s.average} />
                    <StatBox label="SR" value={s.strike_rate} />
                    <StatBox label="HS" value={s.high_score} />
                    <StatBox label="50s" value={String(s.fifties)} last />
                  </>
                );
              })()}
              {view === "bowling" && (() => {
                const s = topRecord as SeasonBowling;
                return (
                  <>
                    <StatBox label="Wickets" value={String(s.wickets)} />
                    <StatBox label="Matches" value={String(s.matches)} />
                    <StatBox label="Economy" value={s.economy} />
                    <StatBox label="Best" value={s.best_figures} />
                    <StatBox label="Overs" value={s.overs} />
                    <StatBox label="SR" value={s.strike_rate} last />
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Season Table */}
      {data.length > 1 && (
        <div className="rounded-2xl overflow-hidden border border-[#333]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#081033] text-white">
                  <th className="px-3 py-3 text-center font-normal tracking-wide w-12">#</th>
                  <th className="px-3 py-3 text-left font-normal tracking-wide">Player</th>
                  <th className="px-3 py-3 text-left font-normal tracking-wide">Team</th>
                  {view === "batting" ? (
                    <>
                      <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">Runs</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Mat</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Inns</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Avg</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">SR</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">HS</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">50s</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">4s</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">6s</th>
                    </>
                  ) : (
                    <>
                      <th className="px-3 py-3 text-center font-normal tracking-wide bg-white/10">Wkts</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Mat</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Inns</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Overs</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Econ</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Best</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">Avg</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">SR</th>
                      <th className="px-3 py-3 text-center font-normal tracking-wide">5W</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-[#fafbfc]">
                {data.slice(1).map((record, idx) => (
                  <tr
                    key={record.player_id || record.player_name}
                    className="border-b border-[#d9d9d9] hover:bg-[#f0f0f0] transition-colors"
                  >
                    <td className="px-3 py-2 text-center text-lg text-black font-normal">{idx + 2}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-[#11141c]">{record.player_name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-[#081033] text-white">
                        {record.team_slug}
                      </span>
                    </td>
                    {view === "batting" && (() => {
                      const s = record as SeasonBatting;
                      return (
                        <>
                          <td className="px-3 py-2 text-center font-bold text-black bg-black/5">{s.runs}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.matches}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.innings}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.average}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.strike_rate}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.high_score}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.fifties}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.fours}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.sixes}</td>
                        </>
                      );
                    })()}
                    {view === "bowling" && (() => {
                      const s = record as SeasonBowling;
                      return (
                        <>
                          <td className="px-3 py-2 text-center font-bold text-black bg-black/5">{s.wickets}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.matches}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.innings}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.overs}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.economy}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.best_figures}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.average}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.strike_rate}</td>
                          <td className="px-3 py-2 text-center text-black/70">{s.five_wickets}</td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
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
