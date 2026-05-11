"use client";

import { useState, useEffect, useCallback } from "react";

interface BatterPerf {
  name: string;
  runs: string;
  balls: string;
  fours: string;
  sixes: string;
  sr: string;
  matchContext?: string;
}

interface BowlerPerf {
  name: string;
  overs: string;
  maidens: string;
  runs: string;
  wickets: string;
  econ: string;
  matchContext?: string;
}

interface MatchData {
  team1: string;
  team2: string;
  teamSlug: string;
  status: string;
  liveData: {
    battingNow: BatterPerf[];
    bowlingNow: BowlerPerf[];
  } | null;
}

const teamColors: Record<string, string> = {
  copters: "#1e40af",
  drones: "#059669",
  jets: "#dc2626",
  rockets: "#7c3aed",
  "unknown-twelves": "#f59e0b",
};

export function PlayerSpotlight() {
  const [topBatters, setTopBatters] = useState<BatterPerf[]>([]);
  const [topBowlers, setTopBowlers] = useState<BowlerPerf[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBatting, setShowBatting] = useState(true);

  useEffect(() => {
    fetchPerformers();
  }, []);

  const currentList = showBatting ? topBatters : topBowlers;

  const rotate = useCallback(() => {
    setActiveIndex((prev) => {
      const list = showBatting ? topBatters : topBowlers;
      if (list.length === 0) return 0;
      return (prev + 1) % list.length;
    });
  }, [showBatting, topBatters, topBowlers]);

  useEffect(() => {
    if (currentList.length <= 1) return;
    const interval = setInterval(rotate, 4000);
    return () => clearInterval(interval);
  }, [currentList.length, rotate]);

  async function fetchPerformers() {
    try {
      const res = await fetch("/api/live-matches");
      const data = await res.json();
      const matches: MatchData[] = data.matches || [];

      const batters: BatterPerf[] = [];
      const bowlers: BowlerPerf[] = [];

      for (const match of matches) {
        if (!match.liveData) continue;
        const context = `${match.team1} vs ${match.team2}`;

        for (const b of match.liveData.battingNow || []) {
          const runs = parseInt(b.runs) || 0;
          if (runs >= 20) {
            batters.push({ ...b, matchContext: context });
          }
        }

        for (const bw of match.liveData.bowlingNow || []) {
          const wickets = parseInt(bw.wickets) || 0;
          if (wickets >= 1) {
            bowlers.push({ ...bw, matchContext: context });
          }
        }
      }

      batters.sort((a, b) => (parseInt(b.runs) || 0) - (parseInt(a.runs) || 0));
      bowlers.sort((a, b) => {
        const wDiff = (parseInt(b.wickets) || 0) - (parseInt(a.wickets) || 0);
        if (wDiff !== 0) return wDiff;
        return (parseFloat(a.econ) || 99) - (parseFloat(b.econ) || 99);
      });

      setTopBatters(batters.slice(0, 8));
      setTopBowlers(bowlers.slice(0, 8));
    } catch {
      // silently fail
    }
  }

  if (topBatters.length === 0 && topBowlers.length === 0) {
    return null;
  }

  const current = currentList[activeIndex] || currentList[0];
  if (!current) return null;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => { setShowBatting(true); setActiveIndex(0); }}
          className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
            showBatting
              ? "bg-white text-black"
              : "bg-[#1a1a1a] text-[#888] border border-[#333] hover:text-white"
          }`}
        >
          Top Batters
        </button>
        <button
          onClick={() => { setShowBatting(false); setActiveIndex(0); }}
          className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
            !showBatting
              ? "bg-white text-black"
              : "bg-[#1a1a1a] text-[#888] border border-[#333] hover:text-white"
          }`}
        >
          Top Bowlers
        </button>
      </div>

      {/* Spotlight Card */}
      <div className="relative overflow-hidden">
        <div className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {currentList.map((player, idx) => (
            <div key={`${player.name}-${idx}`} className="w-full shrink-0 px-1">
              {showBatting ? (
                <BatterCard player={player as BatterPerf} />
              ) : (
                <BowlerCard player={player as BowlerPerf} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {currentList.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {currentList.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`w-2 h-2 rounded-full transition-colors ${
                idx === activeIndex ? "bg-white" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BatterCard({ player }: { player: BatterPerf }) {
  const runs = parseInt(player.runs) || 0;
  const balls = parseInt(player.balls) || 0;
  const fours = parseInt(player.fours) || 0;
  const sixes = parseInt(player.sixes) || 0;

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mx-auto flex items-center justify-center mb-3">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </div>
      <h4 className="text-lg font-bold text-white">{player.name}</h4>
      {player.matchContext && (
        <p className="text-[11px] text-[#666] mt-1">{player.matchContext}</p>
      )}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div>
          <p className="text-3xl font-bold text-yellow-400">{runs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Runs</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white/80">{balls}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Balls</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white/80">{player.sr}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">SR</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-[#888]">
        <span>{fours} fours</span>
        <span>{sixes} sixes</span>
      </div>
    </div>
  );
}

function BowlerCard({ player }: { player: BowlerPerf }) {
  const wickets = parseInt(player.wickets) || 0;

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 mx-auto flex items-center justify-center mb-3">
        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      </div>
      <h4 className="text-lg font-bold text-white">{player.name}</h4>
      {player.matchContext && (
        <p className="text-[11px] text-[#666] mt-1">{player.matchContext}</p>
      )}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div>
          <p className="text-3xl font-bold text-blue-400">{wickets}/{player.runs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Figures</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white/80">{player.overs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Overs</p>
        </div>
        <div>
          <p className="text-xl font-bold text-white/80">{player.econ}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Econ</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-[#888]">
        <span>{player.maidens} maidens</span>
      </div>
    </div>
  );
}
