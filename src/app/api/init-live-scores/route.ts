import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try to insert a test row — if the table doesn't exist, we'll get an error
  const { error: testError } = await supabaseAdmin
    .from("live_scores")
    .select("match_id")
    .limit(1);

  if (testError && testError.code === "PGRST205") {
    return NextResponse.json({
      error: "Table does not exist. Please create it in the Supabase SQL Editor:",
      sql: `CREATE TABLE IF NOT EXISTS live_scores (
  id SERIAL PRIMARY KEY,
  match_id TEXT UNIQUE NOT NULL,
  team_slug TEXT NOT NULL,
  team1_name TEXT,
  team1_score TEXT,
  team1_overs TEXT,
  team2_name TEXT,
  team2_score TEXT,
  team2_overs TEXT,
  status_text TEXT,
  is_live BOOLEAN DEFAULT false,
  batting_now JSONB DEFAULT '[]'::jsonb,
  bowling_now JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_live_scores_match ON live_scores(match_id);
ALTER TABLE live_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON live_scores FOR SELECT USING (true);
CREATE POLICY "Service write access" ON live_scores FOR ALL USING (true) WITH CHECK (true);`,
    }, { status: 400 });
  }

  if (testError) {
    return NextResponse.json({ error: testError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", message: "live_scores table exists" });
}
