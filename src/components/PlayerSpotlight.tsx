"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PlayerPerf {
  name: string;
  type: "bat" | "bowl";
  runs?: string;
  balls?: string;
  fours?: string;
  sixes?: string;
  sr?: string;
  overs?: string;
  maidens?: string;
  wickets?: string;
  econ?: string;
  matchContext: string;
  photoUrl?: string;
  actionPhotos?: string[];
}

interface MatchData {
  team1: string;
  team2: string;
  teamSlug: string;
  status: string;
  liveData: {
    battingNow: { name: string; runs: string; balls: string; fours: string; sixes: string; sr: string }[];
    bowlingNow: { name: string; overs: string; maidens: string; runs: string; wickets: string; econ: string }[];
  } | null;
}

export function PlayerSpotlight() {
  const [performers, setPerformers] = useState<PlayerPerf[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBatting, setShowBatting] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPerformers();
  }, []);

  const currentList = performers.filter((p) => (showBatting ? p.type === "bat" : p.type === "bowl"));

  const rotate = useCallback(() => {
    setActiveIndex((prev) => {
      if (currentList.length === 0) return 0;
      return (prev + 1) % currentList.length;
    });
  }, [currentList.length]);

  useEffect(() => {
    if (currentList.length <= 1) return;
    const interval = setInterval(rotate, 4000);
    return () => clearInterval(interval);
  }, [currentList.length, rotate]);

  async function fetchPerformers() {
    try {
      const [matchRes, playersRes, photosRes] = await Promise.all([
        fetch("/api/live-matches"),
        supabase.from("players").select("name, photo_url"),
        supabase.from("spotlight_photos").select("player_name, photo_url").order("uploaded_at", { ascending: false }),
      ]);
      const data = await matchRes.json();
      const matches: MatchData[] = data.matches || [];

      // Build name sets and maps
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

      // Action photos grouped by player
      const actionPhotosMap = new Map<string, string[]>();
      if (photosRes.data) {
        for (const ph of photosRes.data) {
          const key = ph.player_name.toLowerCase();
          const existing = actionPhotosMap.get(key) || [];
          existing.push(ph.photo_url);
          actionPhotosMap.set(key, existing);
        }
      }

      const batters: PlayerPerf[] = [];
      const bowlers: PlayerPerf[] = [];

      for (const match of matches) {
        if (!match.liveData) continue;
        const context = `${match.team1} vs ${match.team2}`;

        for (const b of match.liveData.battingNow || []) {
          const runs = parseInt(b.runs) || 0;
          if (runs >= 20 && playerNames.has(b.name.toLowerCase())) {
            batters.push({
              name: b.name,
              type: "bat",
              runs: b.runs,
              balls: b.balls,
              fours: b.fours,
              sixes: b.sixes,
              sr: b.sr,
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
              name: bw.name,
              type: "bowl",
              runs: bw.runs,
              overs: bw.overs,
              maidens: bw.maidens,
              wickets: bw.wickets,
              econ: bw.econ,
              matchContext: context,
              photoUrl: photoMap.get(bw.name.toLowerCase()),
              actionPhotos: actionPhotosMap.get(bw.name.toLowerCase()),
            });
          }
        }
      }

      batters.sort((a, b) => (parseInt(b.runs || "0") || 0) - (parseInt(a.runs || "0") || 0));
      bowlers.sort((a, b) => {
        const wDiff = (parseInt(b.wickets || "0") || 0) - (parseInt(a.wickets || "0") || 0);
        if (wDiff !== 0) return wDiff;
        return (parseFloat(a.econ || "99") || 99) - (parseFloat(b.econ || "99") || 99);
      });

      setPerformers([...batters.slice(0, 8), ...bowlers.slice(0, 8)]);
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

  const batCount = performers.filter((p) => p.type === "bat").length;
  const bowlCount = performers.filter((p) => p.type === "bowl").length;

  if (batCount === 0 && bowlCount === 0) {
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
        {batCount > 0 && (
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
        )}
        {bowlCount > 0 && (
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
        )}
      </div>

      {/* Spotlight Cards */}
      {currentList.length > 0 && (
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {currentList.map((player, idx) => (
              <div key={`${player.name}-${idx}`} className="w-full shrink-0 px-1">
                <SpotlightCard
                  player={player}
                  onUploadPhoto={() => {
                    setUploadingFor(player.name);
                    fileInputRef.current?.click();
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

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

function SpotlightCard({ player, onUploadPhoto }: { player: PlayerPerf; onUploadPhoto: () => void }) {
  const isBatter = player.type === "bat";
  const actionPhoto = player.actionPhotos?.[0];

  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] overflow-hidden">
      {/* Action photo banner if available */}
      {actionPhoto && (
        <div className="relative h-32 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={actionPhoto}
            alt={`${player.name} in action`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
        </div>
      )}

      <div className={`flex items-center gap-3 ${actionPhoto ? "px-4 -mt-4 relative" : "px-4 pt-4"}`}>
        {/* Profile photo — only render if available */}
        {player.photoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={player.photoUrl}
            alt={player.name}
            className={`w-10 h-10 rounded-full object-cover shrink-0 ${
              isBatter ? "border-2 border-yellow-400/60" : "border-2 border-blue-400/60"
            }`}
          />
        )}

        <div className="min-w-0">
          <h4 className="text-sm font-bold text-white truncate">{player.name}</h4>
          <p className="text-[10px] text-[#666] truncate">{player.matchContext}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 py-3">
        {isBatter ? (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-yellow-400">{player.runs}</span>
              <span className="text-[10px] text-[#888]">({player.balls})</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#888]">
              <span>SR {player.sr}</span>
              <span>{player.fours}×4</span>
              <span>{player.sixes}×6</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-blue-400">{player.wickets}/{player.runs}</span>
              <span className="text-[10px] text-[#888]">({player.overs} ov)</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#888]">
              <span>Econ {player.econ}</span>
              {parseInt(player.maidens || "0") > 0 && <span>{player.maidens} mdn</span>}
            </div>
          </div>
        )}
      </div>

      {/* Upload photo action */}
      <div className="px-4 pb-3 flex items-center justify-end">
        <button
          onClick={onUploadPhoto}
          className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white/70 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          Add Photo
        </button>
      </div>
    </div>
  );
}
