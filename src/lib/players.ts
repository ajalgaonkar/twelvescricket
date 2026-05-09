import { supabase } from "./supabase";

export interface BattingStats {
  seriesType: string;
  matches: number;
  innings: number;
  notOuts: number;
  runs: number;
  balls: number;
  average: string;
  strikeRate: string;
  highScore: string;
  hundreds: number;
  fifties: number;
  fours: number;
  sixes: number;
}

export interface BowlingStats {
  seriesType: string;
  matches: number;
  innings: number;
  overs: string;
  runs: number;
  wickets: number;
  bestFigures: string;
  maidens: number;
  average: string;
  economy: string;
  strikeRate: string;
  fourWickets: number;
  fiveWickets: number;
  catches: number;
}

export interface Player {
  name: string;
  playerId: string;
  role: string;
  position: string | null;
  photoUrl: string | null;
  profileUrl: string;
  batting: BattingStats[];
  bowling: BowlingStats[];
}

export async function getTeamPlayers(slug: string): Promise<Player[]> {
  const { data: players, error } = await supabase
    .from("players")
    .select("*")
    .eq("team_slug", slug);

  if (error || !players) return [];

  const result: Player[] = [];

  for (const p of players) {
    const { data: battingRows } = await supabase
      .from("batting_stats")
      .select("*")
      .eq("player_id", p.player_id)
      .eq("team_slug", slug);

    const { data: bowlingRows } = await supabase
      .from("bowling_stats")
      .select("*")
      .eq("player_id", p.player_id)
      .eq("team_slug", slug);

    result.push({
      name: p.name,
      playerId: p.player_id,
      role: p.role,
      position: p.position,
      photoUrl: p.photo_url,
      profileUrl: p.profile_url,
      batting: (battingRows || []).map((b) => ({
        seriesType: b.series_type,
        matches: b.matches,
        innings: b.innings,
        notOuts: b.not_outs,
        runs: b.runs,
        balls: b.balls,
        average: b.average,
        strikeRate: b.strike_rate,
        highScore: b.high_score,
        hundreds: b.hundreds,
        fifties: b.fifties,
        fours: b.fours,
        sixes: b.sixes,
      })),
      bowling: (bowlingRows || []).map((b) => ({
        seriesType: b.series_type,
        matches: b.matches,
        innings: b.innings,
        overs: b.overs,
        runs: b.runs,
        wickets: b.wickets,
        bestFigures: b.best_figures,
        maidens: b.maidens,
        average: b.average,
        economy: b.economy,
        strikeRate: b.strike_rate,
        fourWickets: b.four_wickets,
        fiveWickets: b.five_wickets,
        catches: b.catches,
      })),
    });
  }

  return result;
}

export interface PlayerWithTeam extends Player {
  teamSlug: string;
  teamName: string;
  teamColor: string;
  teams: string[];
}

function aggregateBattingByFormat(rows: BattingStats[]): BattingStats[] {
  const byFormat = new Map<string, BattingStats[]>();
  for (const r of rows) {
    const existing = byFormat.get(r.seriesType) || [];
    existing.push(r);
    byFormat.set(r.seriesType, existing);
  }

  const result: BattingStats[] = [];
  for (const [seriesType, stats] of byFormat) {
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
    result.push({
      seriesType,
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
    });
  }
  return result;
}

function aggregateBowlingByFormat(rows: BowlingStats[]): BowlingStats[] {
  const byFormat = new Map<string, BowlingStats[]>();
  for (const r of rows) {
    const existing = byFormat.get(r.seriesType) || [];
    existing.push(r);
    byFormat.set(r.seriesType, existing);
  }

  const result: BowlingStats[] = [];
  for (const [seriesType, stats] of byFormat) {
    const matches = stats.reduce((sum, s) => sum + s.matches, 0);
    const innings = stats.reduce((sum, s) => sum + s.innings, 0);
    const totalBalls = stats.reduce((sum, s) => {
      const parts = String(s.overs).split(".");
      const full = parseInt(parts[0]) || 0;
      const partial = parseInt(parts[1]) || 0;
      return sum + full * 6 + partial;
    }, 0);
    const oversWhole = Math.floor(totalBalls / 6);
    const oversPartial = totalBalls % 6;
    const overs = oversPartial > 0 ? `${oversWhole}.${oversPartial}` : String(oversWhole);
    const runs = stats.reduce((sum, s) => sum + s.runs, 0);
    const wickets = stats.reduce((sum, s) => sum + s.wickets, 0);
    const maidens = stats.reduce((sum, s) => sum + s.maidens, 0);
    const fourWickets = stats.reduce((sum, s) => sum + s.fourWickets, 0);
    const fiveWickets = stats.reduce((sum, s) => sum + s.fiveWickets, 0);
    const catches = stats.reduce((sum, s) => sum + s.catches, 0);
    const economy = totalBalls > 0 ? (runs / (totalBalls / 6)).toFixed(2) : "0";
    const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0";
    const strikeRate = wickets > 0 ? (totalBalls / wickets).toFixed(2) : "0";
    const bestFigures = stats.reduce((best, s) => {
      if (best === "-") return s.bestFigures;
      const [bw] = best.split("/").map(Number);
      const [sw] = s.bestFigures.split("/").map(Number);
      return (sw || 0) > (bw || 0) ? s.bestFigures : best;
    }, "-");
    result.push({
      seriesType,
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
    });
  }
  return result;
}

export async function getAllPlayers(): Promise<PlayerWithTeam[]> {
  const { data: players, error } = await supabase
    .from("players")
    .select("*");

  if (error || !players) return [];

  const { data: allBatting } = await supabase.from("batting_stats").select("*");
  const { data: allBowling } = await supabase.from("bowling_stats").select("*");

  const teamMap: Record<string, { name: string; color: string }> = {
    copters: { name: "Copters", color: "#1e40af" },
    drones: { name: "Drones", color: "#059669" },
    jets: { name: "Jets", color: "#dc2626" },
    rockets: { name: "Rockets", color: "#7c3aed" },
  };

  // Group players by playerId to merge across teams/leagues
  const playerMap = new Map<string, {
    name: string;
    playerId: string;
    role: string;
    position: string | null;
    photoUrl: string | null;
    profileUrl: string;
    teams: string[];
    teamSlug: string;
    teamColor: string;
    battingRows: BattingStats[];
    bowlingRows: BowlingStats[];
  }>();

  for (const p of players) {
    const team = teamMap[p.team_slug] || { name: p.team_slug, color: "#666" };
    const existing = playerMap.get(p.player_id);

    const battingRows = (allBatting || [])
      .filter((b) => b.player_id === p.player_id && b.team_slug === p.team_slug)
      .map((b) => ({
        seriesType: b.series_type,
        matches: b.matches,
        innings: b.innings,
        notOuts: b.not_outs,
        runs: b.runs,
        balls: b.balls,
        average: b.average,
        strikeRate: b.strike_rate,
        highScore: b.high_score,
        hundreds: b.hundreds,
        fifties: b.fifties,
        fours: b.fours,
        sixes: b.sixes,
      }));

    const bowlingRows = (allBowling || [])
      .filter((b) => b.player_id === p.player_id && b.team_slug === p.team_slug)
      .map((b) => ({
        seriesType: b.series_type,
        matches: b.matches,
        innings: b.innings,
        overs: b.overs,
        runs: b.runs,
        wickets: b.wickets,
        bestFigures: b.best_figures,
        maidens: b.maidens,
        average: b.average,
        economy: b.economy,
        strikeRate: b.strike_rate,
        fourWickets: b.four_wickets,
        fiveWickets: b.five_wickets,
        catches: b.catches,
      }));

    if (existing) {
      if (!existing.teams.includes(team.name)) {
        existing.teams.push(team.name);
      }
      existing.battingRows.push(...battingRows);
      existing.bowlingRows.push(...bowlingRows);
      if (!existing.position && p.position) {
        existing.position = p.position;
      }
    } else {
      playerMap.set(p.player_id, {
        name: p.name,
        playerId: p.player_id,
        role: p.role,
        position: p.position,
        photoUrl: p.photo_url,
        profileUrl: p.profile_url,
        teams: [team.name],
        teamSlug: p.team_slug,
        teamColor: team.color,
        battingRows,
        bowlingRows,
      });
    }
  }

  const result: PlayerWithTeam[] = [];
  for (const p of playerMap.values()) {
    result.push({
      name: p.name,
      playerId: p.playerId,
      role: p.role,
      position: p.position,
      photoUrl: p.photoUrl,
      profileUrl: p.profileUrl,
      teamSlug: p.teamSlug,
      teamName: p.teams.join(", "),
      teamColor: p.teamColor,
      teams: p.teams,
      batting: aggregateBattingByFormat(p.battingRows),
      bowling: aggregateBowlingByFormat(p.bowlingRows),
    });
  }

  return result;
}

export function getPositionLabel(position: string | null): string | null {
  if (!position) return null;
  switch (position) {
    case "C":
      return "Captain";
    case "VC":
      return "Vice Captain";
    case "WK":
      return "Wicket Keeper";
    default:
      return position;
  }
}
