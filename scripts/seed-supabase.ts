import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const teamsConfig = [
  { slug: "copters", name: "Twelves Copters", shortName: "Copters", teamId: 1455, leagueId: 160, clubId: 232, color: "#1e40af", description: "The strategic arm of Twelves Cricket Club, competing in Division 1." },
  { slug: "drones", name: "Twelves Drones", shortName: "Drones", teamId: 1470, leagueId: 161, clubId: 232, color: "#059669", description: "Quick, agile, and always watching — the Drones patrol Division 2." },
  { slug: "jets", name: "Twelves Jets", shortName: "Jets", teamId: 1480, leagueId: 162, clubId: 232, color: "#dc2626", description: "Speed and power define the Jets in Division 3." },
  { slug: "rockets", name: "Twelves Rockets", shortName: "Rockets", teamId: 1494, leagueId: 163, clubId: 232, color: "#7c3aed", description: "Explosive talent launching in Division 4." },
];

async function main() {
  console.log("Seeding teams...");
  const { error: teamsError } = await supabase.from("teams").upsert(
    teamsConfig.map((t) => ({
      slug: t.slug,
      name: t.name,
      short_name: t.shortName,
      team_id: t.teamId,
      league_id: t.leagueId,
      club_id: t.clubId,
      color: t.color,
      description: t.description,
    })),
    { onConflict: "slug" }
  );
  if (teamsError) {
    console.error("Teams error:", teamsError);
    return;
  }
  console.log("  Teams seeded.");

  // Seed players
  const playersPath = path.join(__dirname, "../src/data/players.json");
  const playersData = JSON.parse(fs.readFileSync(playersPath, "utf-8"));

  for (const [slug, teamData] of Object.entries(playersData) as [string, any][]) {
    const players = teamData.players;
    console.log(`\nSeeding ${players.length} players for ${slug}...`);

    for (const player of players) {
      const { error: playerError } = await supabase.from("players").upsert(
        {
          team_slug: slug,
          player_id: player.playerId,
          name: player.name,
          role: player.role,
          position: player.position,
          photo_url: player.photoUrl,
          profile_url: player.profileUrl,
        },
        { onConflict: "team_slug,player_id" }
      );
      if (playerError) {
        console.error(`  Player error (${player.name}):`, playerError);
        continue;
      }

      // Batting stats — aggregate by seriesType across all leagues
      if (player.batting && player.batting.length > 0) {
        const battingByFormat = new Map<string, any[]>();
        for (const stat of player.batting) {
          const existing = battingByFormat.get(stat.seriesType) || [];
          existing.push(stat);
          battingByFormat.set(stat.seriesType, existing);
        }
        for (const [seriesType, stats] of battingByFormat) {
          const matches = stats.reduce((s: number, r: any) => s + r.matches, 0);
          const innings = stats.reduce((s: number, r: any) => s + r.innings, 0);
          const notOuts = stats.reduce((s: number, r: any) => s + r.notOuts, 0);
          const runs = stats.reduce((s: number, r: any) => s + r.runs, 0);
          const balls = stats.reduce((s: number, r: any) => s + r.balls, 0);
          const fifties = stats.reduce((s: number, r: any) => s + r.fifties, 0);
          const hundreds = stats.reduce((s: number, r: any) => s + r.hundreds, 0);
          const fours = stats.reduce((s: number, r: any) => s + r.fours, 0);
          const sixes = stats.reduce((s: number, r: any) => s + r.sixes, 0);
          const dismissals = innings - notOuts;
          const average = dismissals > 0 ? (runs / dismissals).toFixed(2) : "0";
          const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : "0";
          const highScore = stats.reduce((best: string, r: any) => {
            const curr = parseInt(r.highScore) || 0;
            const prev = parseInt(best) || 0;
            return curr > prev ? r.highScore : best;
          }, "0");
          await supabase.from("batting_stats").upsert(
            {
              player_id: player.playerId,
              team_slug: slug,
              series_type: seriesType,
              matches,
              innings,
              not_outs: notOuts,
              runs,
              balls,
              average,
              strike_rate: strikeRate,
              high_score: highScore,
              hundreds,
              fifties,
              fours,
              sixes,
            },
            { onConflict: "player_id,team_slug,series_type" }
          );
        }
      }

      // Bowling stats — aggregate by seriesType across all leagues
      if (player.bowling && player.bowling.length > 0) {
        const bowlingByFormat = new Map<string, any[]>();
        for (const stat of player.bowling) {
          const existing = bowlingByFormat.get(stat.seriesType) || [];
          existing.push(stat);
          bowlingByFormat.set(stat.seriesType, existing);
        }
        for (const [seriesType, stats] of bowlingByFormat) {
          const matches = stats.reduce((s: number, r: any) => s + r.matches, 0);
          const innings = stats.reduce((s: number, r: any) => s + r.innings, 0);
          const totalBalls = stats.reduce((s: number, r: any) => {
            const parts = String(r.overs).split(".");
            const full = parseInt(parts[0]) || 0;
            const partial = parseInt(parts[1]) || 0;
            return s + full * 6 + partial;
          }, 0);
          const oversWhole = Math.floor(totalBalls / 6);
          const oversPartial = totalBalls % 6;
          const overs = oversPartial > 0 ? `${oversWhole}.${oversPartial}` : String(oversWhole);
          const runs = stats.reduce((s: number, r: any) => s + r.runs, 0);
          const wickets = stats.reduce((s: number, r: any) => s + r.wickets, 0);
          const maidens = stats.reduce((s: number, r: any) => s + r.maidens, 0);
          const fourWickets = stats.reduce((s: number, r: any) => s + r.fourWickets, 0);
          const fiveWickets = stats.reduce((s: number, r: any) => s + r.fiveWickets, 0);
          const catches = stats.reduce((s: number, r: any) => s + r.catches, 0);
          const economy = totalBalls > 0 ? (runs / (totalBalls / 6)).toFixed(2) : "0";
          const average = wickets > 0 ? (runs / wickets).toFixed(2) : "0";
          const strikeRate = wickets > 0 ? (totalBalls / wickets).toFixed(2) : "0";
          const bestFigures = stats.reduce((best: string, r: any) => {
            if (best === "-") return r.bestFigures;
            const [bw] = best.split("/").map(Number);
            const [sw] = r.bestFigures.split("/").map(Number);
            return (sw || 0) > (bw || 0) ? r.bestFigures : best;
          }, "-");
          await supabase.from("bowling_stats").upsert(
            {
              player_id: player.playerId,
              team_slug: slug,
              series_type: seriesType,
              matches,
              innings,
              overs,
              runs,
              wickets,
              best_figures: bestFigures,
              maidens,
              average,
              economy,
              strike_rate: strikeRate,
              four_wickets: fourWickets,
              five_wickets: fiveWickets,
              catches,
            },
            { onConflict: "player_id,team_slug,series_type" }
          );
        }
      }
    }
    console.log(`  Done: ${slug}`);
  }

  // Seed matches
  const schedulesPath = path.join(__dirname, "../src/data/schedules.json");
  const schedulesData = JSON.parse(fs.readFileSync(schedulesPath, "utf-8"));

  for (const [slug, entry] of Object.entries(schedulesData) as [string, any][]) {
    const matches = entry.matches || [];
    console.log(`\nSeeding ${matches.length} matches for ${slug}...`);
    for (const match of matches) {
      const { error } = await supabase.from("matches").upsert(
        {
          team_slug: slug,
          match_id: match.matchId,
          date: match.date,
          time: match.time,
          match_type: match.matchType,
          series: match.series,
          division: match.division,
          team1: match.team1,
          team2: match.team2,
          ground: match.ground,
          result: match.result,
          scorecard_url: match.scorecardUrl,
        },
        { onConflict: "team_slug,match_id" }
      );
      if (error) console.error(`  Match error:`, error);
    }
    console.log(`  Done: ${slug}`);
  }

  console.log("\nSeeding complete!");
}

main().catch(console.error);
