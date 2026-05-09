import playersData from "@/data/players.json";

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

interface TeamPlayers {
  team: string;
  players: Player[];
  fetchedAt: string;
}

const data = playersData as Record<string, TeamPlayers>;

export function getTeamPlayers(slug: string): Player[] {
  const entry = data[slug];
  if (!entry) return [];
  return entry.players;
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
