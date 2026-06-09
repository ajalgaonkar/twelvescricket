import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: batErr } = await supabaseAdmin
    .from("season_batting_stats")
    .select("id")
    .limit(1);

  const { error: bowlErr } = await supabaseAdmin
    .from("season_bowling_stats")
    .select("id")
    .limit(1);

  if (batErr || bowlErr) {
    return NextResponse.json({
      error: "Tables do not exist. Please create them in the Supabase SQL Editor:",
      sql: `CREATE TABLE IF NOT EXISTS season_batting_stats (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  not_outs INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  high_score TEXT DEFAULT '0',
  average TEXT DEFAULT '0',
  strike_rate TEXT DEFAULT '0',
  hundreds INTEGER DEFAULT 0,
  fifties INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  UNIQUE(season, player_id, team_slug)
);
CREATE INDEX IF NOT EXISTS idx_season_batting_season ON season_batting_stats(season);
CREATE INDEX IF NOT EXISTS idx_season_batting_team ON season_batting_stats(team_slug);
ALTER TABLE season_batting_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON season_batting_stats FOR SELECT USING (true);
CREATE POLICY "Service write access" ON season_batting_stats FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS season_bowling_stats (
  id SERIAL PRIMARY KEY,
  season INTEGER NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  overs TEXT DEFAULT '0',
  maidens INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  best_figures TEXT DEFAULT '-',
  average TEXT DEFAULT '0',
  economy TEXT DEFAULT '0',
  strike_rate TEXT DEFAULT '0',
  four_wickets INTEGER DEFAULT 0,
  five_wickets INTEGER DEFAULT 0,
  UNIQUE(season, player_id, team_slug)
);
CREATE INDEX IF NOT EXISTS idx_season_bowling_season ON season_bowling_stats(season);
CREATE INDEX IF NOT EXISTS idx_season_bowling_team ON season_bowling_stats(team_slug);
ALTER TABLE season_bowling_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON season_bowling_stats FOR SELECT USING (true);
CREATE POLICY "Service write access" ON season_bowling_stats FOR ALL USING (true) WITH CHECK (true);`,
    }, { status: 400 });
  }

  return NextResponse.json({ status: "ok", message: "season stats tables exist" });
}
