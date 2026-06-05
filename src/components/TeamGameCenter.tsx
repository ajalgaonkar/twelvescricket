"use client";

import { useState, useEffect } from "react";

interface MatchResult {
  matchId: string;
  team1Name: string;
  team1Score: string;
  team1Overs: string;
  team2Name: string;
  team2Score: string;
  team2Overs: string;
  statusText: string;
  matchDate: string | null;
  scorecardUrl: string | null;
}

export function TeamGameCenter({ teamSlug, teamColor }: { teamSlug: string; teamColor: string }) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch(`/api/match-results?team=${teamSlug}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [teamSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-white/60">
          <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
          <span className="text-sm">Loading results...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[#888] text-sm">No match results available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {results.map((match) => (
        <ResultCard key={match.matchId} match={match} teamColor={teamColor} />
      ))}
    </div>
  );
}

function ResultCard({ match, teamColor }: { match: MatchResult; teamColor: string }) {
  const t1Runs = parseInt(match.team1Score) || 0;
  const t2Runs = parseInt(match.team2Score) || 0;
  const t1Won = t1Runs > t2Runs;
  const t2Won = t2Runs > t1Runs;

  let winText = match.statusText || "";
  if (!winText) {
    if (t1Won) winText = `${match.team1Name} won`;
    else if (t2Won) winText = `${match.team2Name} won`;
    else winText = "Match tied";
  }

  const formattedDate = match.matchDate
    ? new Date(match.matchDate + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const cleanOvers = (ov: string) => ov.split("/")[0].trim();
  const t1Overs = match.team1Overs ? cleanOvers(match.team1Overs) : "";
  const t2Overs = match.team2Overs ? cleanOvers(match.team2Overs) : "";

  return (
    <a
      href={match.scorecardUrl || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-colors"
    >
      <div className="h-1" style={{ backgroundColor: teamColor }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600">
            Completed
          </span>
          {formattedDate && (
            <span className="text-[10px] text-[#666]">{formattedDate}</span>
          )}
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
                {match.team1Name}
              </p>
            </div>
            {match.team1Score && (
              <span className={`text-sm font-bold shrink-0 ${t1Won ? "text-green-400" : "text-white/50"}`}>
                {match.team1Score}
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
                {match.team2Name}
              </p>
            </div>
            {match.team2Score && (
              <span className={`text-sm font-bold shrink-0 ${t2Won ? "text-green-400" : "text-white/50"}`}>
                {match.team2Score}
              </span>
            )}
          </div>
        </div>
        {t1Overs && t2Overs && (
          <div className="flex items-center justify-between text-[10px] text-[#666] mt-2">
            <span>({t1Overs} ov)</span>
            <span>({t2Overs} ov)</span>
          </div>
        )}
        {winText && (
          <p className="text-xs text-green-400 mt-3 pt-2 border-t border-[#333] line-clamp-2">
            {winText}
          </p>
        )}
      </div>
    </a>
  );
}
