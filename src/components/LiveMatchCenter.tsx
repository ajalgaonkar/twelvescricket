"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/live-matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => {
      clearInterval(interval);
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [fetchMatches]);

  async function triggerRefresh(mode: "live" | "backfill" = "live") {
    setRefreshing(true);
    setRefreshMsg(mode === "backfill" ? "Backfilling results..." : "Scraping live scores...");
    try {
      const res = await fetch(`/api/trigger-refresh?mode=${mode}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRefreshMsg(mode === "backfill" ? "Backfill running — results in ~5 min..." : "Scraper running — polling for updates...");
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          await fetchMatches();
          if (attempts >= 15) {
            if (pollRef.current) clearInterval(pollRef.current);
            setRefreshMsg("");
            setRefreshing(false);
          }
        }, 10000);
        timeoutRef.current = setTimeout(() => {
          if (pollRef.current) clearInterval(pollRef.current);
          setRefreshMsg("");
          setRefreshing(false);
        }, 150000);
      } else {
        setRefreshMsg(data.error || "Failed to trigger refresh");
        setRefreshing(false);
      }
    } catch {
      setRefreshMsg("Failed to trigger refresh");
      setRefreshing(false);
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
      {/* Refresh Buttons */}
      <div className="flex items-center justify-end gap-3">
        {refreshMsg && (
          <span className="text-xs text-yellow-400">{refreshMsg}</span>
        )}
        <button
          onClick={() => triggerRefresh("backfill")}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 bg-[#1a1a1a] border border-[#333] rounded-lg hover:border-[#555] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {refreshing ? "Triggering..." : "Update Results"}
        </button>
        <button
          onClick={() => triggerRefresh("live")}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/70 bg-[#1a1a1a] border border-[#333] rounded-lg hover:border-[#555] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "Triggering..." : "Refresh Scores"}
        </button>
      </div>

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
              <LiveCard key={`${match.matchId}-${match.teamSlug}`} match={match} />
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
              <CompletedCard key={`${match.matchId}-${match.teamSlug}`} match={match} />
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
              <UpcomingCard key={`${match.matchId}-${match.teamSlug}`} match={match} />
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
                {ld.battingNow.map((b, i) => (
                  <tr key={`${b.name}-${i}`} className="text-white/80">
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
                {ld.bowlingNow.map((b, i) => (
                  <tr key={`${b.name}-${i}`} className="text-white/80">
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
  const ld = match.liveData;
  const t1Runs = parseInt(ld?.team1Score || "0") || 0;
  const t2Runs = parseInt(ld?.team2Score || "0") || 0;
  const t1Won = t1Runs > t2Runs;
  const t2Won = t2Runs > t1Runs;

  let winText = match.result || "";
  if (!winText && ld) {
    if (t1Won) winText = `${match.team1} won`;
    else if (t2Won) winText = `${match.team2} won`;
    else winText = "Match tied";
  }

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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {t1Won && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              <p className={`text-sm font-semibold truncate ${t1Won ? "text-green-400" : "text-white/50"}`}>
                {match.team1}
              </p>
            </div>
            {ld?.team1Score && (
              <span className={`text-sm font-bold shrink-0 ${t1Won ? "text-green-400" : "text-white/50"}`}>
                {ld.team1Score}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {t2Won && (
                <span className="shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              <p className={`text-sm font-semibold truncate ${t2Won ? "text-green-400" : "text-white/50"}`}>
                {match.team2}
              </p>
            </div>
            {ld?.team2Score && (
              <span className={`text-sm font-bold shrink-0 ${t2Won ? "text-green-400" : "text-white/50"}`}>
                {ld.team2Score}
              </span>
            )}
          </div>
        </div>
        {winText && (
          <p className="text-xs text-green-400 mt-3 pt-2 border-t border-[#333] line-clamp-2">
            {winText}
          </p>
        )}
      </div>
    </a>
  );
}
