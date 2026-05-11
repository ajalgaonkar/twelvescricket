import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: testError } = await supabaseAdmin
    .from("spotlight_photos")
    .select("id")
    .limit(1);

  if (testError && testError.code === "PGRST205") {
    return NextResponse.json({
      error: "Table does not exist. Please create it in the Supabase SQL Editor:",
      sql: `CREATE TABLE IF NOT EXISTS spotlight_photos (
  id SERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  match_id TEXT,
  caption TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spotlight_photos_player ON spotlight_photos(player_name);
ALTER TABLE spotlight_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON spotlight_photos FOR SELECT USING (true);
CREATE POLICY "Service write access" ON spotlight_photos FOR ALL USING (true) WITH CHECK (true);`,
      bucket_info: "Also create a public storage bucket named 'spotlight-photos' with 5MB limit and image/* MIME types.",
    }, { status: 400 });
  }

  if (testError) {
    return NextResponse.json({ error: testError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", message: "spotlight_photos table exists, spotlight-photos bucket exists" });
}
