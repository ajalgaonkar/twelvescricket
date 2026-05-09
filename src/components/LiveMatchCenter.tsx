"use client";

import { useState, useEffect } from "react";

interface LiveData {
  team1Score: string;
  team1Overs: string;
  team2Score: string;
  team2Overs: string;
  statusText: string;
  battingNow: { name: string; runs: string; balls: string; fours: string; sixes: string; sr: string }[];
  bowlingNow: { name: string; overs: string; maidens: string; runs: string; wickets: string; econ: string }[];
}

interface MatchCenterItem {
  matchId: string;
  team1: string;
  team2: string;
  date: string | null;
  time: string | null;
  matchType: string | null;
  ground: string | null;
  division: string | null;
  result: string | null;
  scorecardUrl: string;
  teamSlug: string;
  teamColor: string;
  status: "live" | "completed" | "upcoming";
  liveData: LiveData | null;
}

export function LiveMatchCenter() {
  const [matches, setMatches] = useState<MatchCenterItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchMatches() {
    try {
      const res = await fetch("/api/live-matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-white/60">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
          <span className="text-sm">Loading matches...</span>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#888] text-sm">
          No matches scheduled at the moment.
        </p>
      </div>
    );
  }

  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  const completedMatches = matches.filter((m) => m.status === "completed");

  return (
    <div className="space-y-6">
      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400">
              Live Now
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <LiveCard key={match.matchId} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {upcomingMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#888] mb-3">
            Upcoming
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {upcomingMatches.map((match) => (
              <UpcomingCard key={match.matchId} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {completedMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#888] mb-3">
            Recent Results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {completedMatches.map((match) => (
              <CompletedCard key={match.matchId} match={match} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveCard({ match }: { match: MatchCenterItem }) {
  const ld = match.liveData;

  return (
    <a
      href={match.scorecardUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#1a1a1a] rounded-xl overflow-hidden border border-red-900/40 hover:border-red-700/60 transition-colors"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-red-950/30">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
            Live
          </span>
        </span>
        <span className="text-[11px] text-[#888]">
          {match.matchType || "League"}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-white truncate">
              {match.team1}
            </p>
            {ld && (
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-white">
                  {ld.team1Score || "-"}
                </span>
                {ld.team1Overs && (
                  <span className="text-xs text-[#888]">({ld.team1Overs})</span>
                )}
              </div>
            )}
          </div>
          <div className="text-xs font-bold text-[#555] shrink-0 px-2">VS</div>
          <div className="flex-1 text-right">
            <p className="text-sm font-semibold text-white truncate">
              {match.team2}
            </p>
            {ld && (
              <div className="flex items-baseline gap-2 mt-1 justify-end">
                {ld.team2Overs && (
                  <span className="text-xs text-[#888]">({ld.team2Overs})</span>
                )}
                <span className="text-2xl font-bold text-white">
                  {ld.team2Score || "-"}
                </span>
              </div>
            )}
          </div>
        </div>

        {ld?.statusText && (
          <p className="text-xs text-yellow-400 text-center mt-3 pt-3 border-t border-[#333]">
            {ld.statusText}
          </p>
        )}

        {ld && ld.battingNow.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#333]">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#666]">
                  <th className="text-left font-normal pb-1">Batter</th>
                  <th className="text-center font-normal pb-1">R</th>
                  <th className="text-center font-normal pb-1">B</th>
                  <th className="text-center font-normal pb-1">4s</th>
                  <th className="text-center font-normal pb-1">6s</th>
                  <th className="text-center font-normal pb-1">SR</th>
                </tr>
              </thead>
              <tbody>
                {ld.battingNow.map((b) => (
                  <tr key={b.name} className="text-white/80">
                    <td className="text-left py-0.5 font-medium">{b.name}</td>
                    <td className="text-center py-0.5 font-bold text-white">{b.runs}</td>
                    <td className="text-center py-0.5">{b.balls}</td>
                    <td className="text-center py-0.5">{b.fours}</td>
                    <td className="text-center py-0.5">{b.sixes}</td>
                    <td className="text-center py-0.5">{b.sr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ld && ld.bowlingNow.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#333]/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#666]">
                  <th className="text-left font-normal pb-1">Bowler</th>
                  <th className="text-center font-normal pb-1">O</th>
                  <th className="text-center font-normal pb-1">M</th>
                  <th className="text-center font-normal pb-1">R</th>
                  <th className="text-center font-normal pb-1">W</th>
                  <th className="text-center font-normal pb-1">Econ</th>
                </tr>
              </thead>
              <tbody>
                {ld.bowlingNow.map((b) => (
                  <tr key={b.name} className="text-white/80">
                    <td className="text-left py-0.5 font-medium">{b.name}</td>
                    <td className="text-center py-0.5">{b.overs}</td>
                    <td className="text-center py-0.5">{b.maidens}</td>
                    <td className="text-center py-0.5">{b.runs}</td>
                    <td className="text-center py-0.5 font-bold text-white">{b.wickets}</td>
                    <td className="text-center py-0.5">{b.econ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="h-1" style={{ backgroundColor: match.teamColor }} />
    </a>
  );
}

function UpcomingCard({ match }: { match: MatchCenterItem }) {
  return (
    <div className="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-colors">
      <div className="h-1" style={{ backgroundColor: match.teamColor }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
            {match.matchType || "League"}
          </span>
          <span className="text-[10px] text-[#666]">{match.date}</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white truncate">{match.team1}</p>
          <p className="text-[10px] text-[#555] font-bold">VS</p>
          <p className="text-sm font-semibold text-white truncate">{match.team2}</p>
        </div>
        {match.time && (
          <p className="text-xs text-[#888] mt-3">{match.time}</p>
        )}
        {match.ground && (
          <p className="text-[10px] text-[#666] mt-1 truncate">{match.ground}</p>
        )}
      </div>
    </div>
  );
}

function CompletedCard({ match }: { match: MatchCenterItem }) {
  return (
    <a
      href={match.scorecardUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-colors"
    >
      <div className="h-1" style={{ backgroundColor: match.teamColor }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
            Completed
          </span>
          <span className="text-[10px] text-[#666]">{match.date}</span>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white truncate">{match.team1}</p>
          <p className="text-[10px] text-[#555] font-bold">VS</p>
          <p className="text-sm font-semibold text-white truncate">{match.team2}</p>
        </div>
        {match.result && (
          <p className="text-xs text-green-400 mt-3 line-clamp-2">{match.result}</p>
        )}
      </div>
    </a>
  );
}
