import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: testError } = await supabaseAdmin
    .from("match_results")
    .select("match_id")
    .limit(1);

  if (testError && testError.code === "PGRST205") {
    return NextResponse.json({
      error: "Table does not exist. Please create it in the Supabase SQL Editor:",
      sql: `CREATE TABLE IF NOT EXISTS match_results (
  id SERIAL PRIMARY KEY,
  match_id TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  team1_name TEXT NOT NULL,
  team1_score TEXT,
  team1_overs TEXT,
  team2_name TEXT NOT NULL,
  team2_score TEXT,
  team2_overs TEXT,
  status_text TEXT,
  batting_summary JSONB DEFAULT '[]'::jsonb,
  bowling_summary JSONB DEFAULT '[]'::jsonb,
  match_date DATE,
  scorecard_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, team_slug)
);
CREATE INDEX IF NOT EXISTS idx_match_results_team ON match_results(team_slug);
CREATE INDEX IF NOT EXISTS idx_match_results_date ON match_results(match_date DESC);
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON match_results FOR SELECT USING (true);
CREATE POLICY "Service write access" ON match_results FOR ALL USING (true) WITH CHECK (true);`,
    }, { status: 400 });
  }

  if (testError) {
    return NextResponse.json({ error: testError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", message: "match_results table exists" });
}
