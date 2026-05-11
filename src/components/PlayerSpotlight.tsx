"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface BatterPerf {
  name: string;
  runs: string;
  balls: string;
  fours: string;
  sixes: string;
  sr: string;
  matchContext?: string;
  photoUrl?: string;
  actionPhotos?: string[];
}

interface BowlerPerf {
  name: string;
  overs: string;
  maidens: string;
  runs: string;
  wickets: string;
  econ: string;
  matchContext?: string;
  photoUrl?: string;
  actionPhotos?: string[];
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

export function PlayerSpotlight() {
  const [topBatters, setTopBatters] = useState<BatterPerf[]>([]);
  const [topBowlers, setTopBowlers] = useState<BowlerPerf[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBatting, setShowBatting] = useState(true);
  const [paused, setPaused] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (currentList.length <= 1 || paused) return;
    const interval = setInterval(rotate, 7000);
    return () => clearInterval(interval);
  }, [currentList.length, rotate, paused]);

  function goNext() {
    if (currentList.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % currentList.length);
  }

  function goPrev() {
    if (currentList.length === 0) return;
    setActiveIndex((prev) => (prev - 1 + currentList.length) % currentList.length);
  }

  async function fetchPerformers() {
    try {
      const [matchRes, playersRes, photosRes] = await Promise.all([
        fetch("/api/live-matches"),
        supabase.from("players").select("name, photo_url"),
        supabase.from("spotlight_photos").select("player_name, photo_url").order("uploaded_at", { ascending: false }),
      ]);
      const data = await matchRes.json();
      const matches: MatchData[] = data.matches || [];

      const playerNames = new Set<string>();
      const photoMap = new Map<string, string>();
      if (playersRes.data) {
        for (const p of playersRes.data) {
          playerNames.add(p.name.toLowerCase());
          if (p.photo_url) {
            photoMap.set(p.name.toLowerCase(), p.photo_url);
          }
        }
      }

      const actionPhotosMap = new Map<string, string[]>();
      if (photosRes.data) {
        for (const ph of photosRes.data) {
          const key = ph.player_name.toLowerCase();
          const existing = actionPhotosMap.get(key) || [];
          existing.push(ph.photo_url);
          actionPhotosMap.set(key, existing);
        }
      }

      const batters: BatterPerf[] = [];
      const bowlers: BowlerPerf[] = [];

      for (const match of matches) {
        if (!match.liveData) continue;
        const context = `${match.team1} vs ${match.team2}`;

        for (const b of match.liveData.battingNow || []) {
          const runs = parseInt(b.runs) || 0;
          if (runs >= 20 && playerNames.has(b.name.toLowerCase())) {
            batters.push({
              ...b,
              matchContext: context,
              photoUrl: photoMap.get(b.name.toLowerCase()),
              actionPhotos: actionPhotosMap.get(b.name.toLowerCase()),
            });
          }
        }

        for (const bw of match.liveData.bowlingNow || []) {
          const wickets = parseInt(bw.wickets) || 0;
          if (wickets >= 1 && playerNames.has(bw.name.toLowerCase())) {
            bowlers.push({
              ...bw,
              matchContext: context,
              photoUrl: photoMap.get(bw.name.toLowerCase()),
              actionPhotos: actionPhotosMap.get(bw.name.toLowerCase()),
            });
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingFor) return;

    const formData = new FormData();
    formData.append("photo", file);
    formData.append("playerName", uploadingFor);

    try {
      const res = await fetch("/api/spotlight-photos", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        fetchPerformers();
      }
    } catch {
      // silently fail
    }
    setUploadingFor(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (topBatters.length === 0 && topBowlers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />

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

      {/* Spotlight Card with navigation */}
      <div className="relative">
        {/* Prev/Next arrows */}
        {currentList.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
              aria-label="Previous"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
              aria-label="Next"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </>
        )}

        <div className="overflow-hidden mx-8">
          <div className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {currentList.map((player, idx) => (
              <div key={`${player.name}-${idx}`} className="w-full shrink-0 px-1">
                {showBatting ? (
                  <BatterCard
                    player={player as BatterPerf}
                    onUploadPhoto={() => { setUploadingFor(player.name); fileInputRef.current?.click(); }}
                  />
                ) : (
                  <BowlerCard
                    player={player as BowlerPerf}
                    onUploadPhoto={() => { setUploadingFor(player.name); fileInputRef.current?.click(); }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dots + Pause */}
      {currentList.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
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
          <button
            onClick={() => setPaused(!paused)}
            className="ml-2 w-5 h-5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
            aria-label={paused ? "Play" : "Pause"}
          >
            {paused ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionPhotoBanner({ photos, playerName }: { photos?: string[]; playerName: string }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="relative h-28 w-full mb-3 rounded-lg overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[0]}
        alt={`${playerName} in action`}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a]/80 to-transparent" />
      {photos.length > 1 && (
        <span className="absolute top-2 right-2 text-[9px] bg-black/60 text-white/70 px-1.5 py-0.5 rounded-full">
          +{photos.length - 1}
        </span>
      )}
    </div>
  );
}

function UploadButton({ onUpload }: { onUpload: () => void }) {
  return (
    <button
      onClick={onUpload}
      className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white/70 transition-colors mt-3"
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      Add Photo
    </button>
  );
}

function BatterCard({ player, onUploadPhoto }: { player: BatterPerf; onUploadPhoto: () => void }) {
  const runs = parseInt(player.runs) || 0;
  const balls = parseInt(player.balls) || 0;
  const fours = parseInt(player.fours) || 0;
  const sixes = parseInt(player.sixes) || 0;

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 text-center">
      <ActionPhotoBanner photos={player.actionPhotos} playerName={player.name} />
      {player.photoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt={player.name}
          className="w-11 h-11 rounded-full mx-auto mb-2 object-cover border-2 border-yellow-400/50"
        />
      )}
      <h4 className="text-base font-bold text-white">{player.name}</h4>
      {player.matchContext && (
        <p className="text-[11px] text-[#666] mt-0.5">{player.matchContext}</p>
      )}
      <div className="mt-3 flex items-center justify-center gap-6">
        <div>
          <p className="text-2xl font-bold text-yellow-400">{runs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Runs</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white/80">{balls}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Balls</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white/80">{player.sr}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">SR</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[#888]">
        <span>{fours} fours</span>
        <span>{sixes} sixes</span>
      </div>
      <UploadButton onUpload={onUploadPhoto} />
    </div>
  );
}

function BowlerCard({ player, onUploadPhoto }: { player: BowlerPerf; onUploadPhoto: () => void }) {
  const wickets = parseInt(player.wickets) || 0;

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-5 text-center">
      <ActionPhotoBanner photos={player.actionPhotos} playerName={player.name} />
      {player.photoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={player.photoUrl}
          alt={player.name}
          className="w-11 h-11 rounded-full mx-auto mb-2 object-cover border-2 border-blue-400/50"
        />
      )}
      <h4 className="text-base font-bold text-white">{player.name}</h4>
      {player.matchContext && (
        <p className="text-[11px] text-[#666] mt-0.5">{player.matchContext}</p>
      )}
      <div className="mt-3 flex items-center justify-center gap-6">
        <div>
          <p className="text-2xl font-bold text-blue-400">{wickets}/{player.runs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Figures</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white/80">{player.overs}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Overs</p>
        </div>
        <div>
          <p className="text-lg font-bold text-white/80">{player.econ}</p>
          <p className="text-[10px] text-[#888] uppercase tracking-wider mt-0.5">Econ</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[#888]">
        <span>{player.maidens} maidens</span>
      </div>
      <UploadButton onUpload={onUploadPhoto} />
    </div>
  );
}
