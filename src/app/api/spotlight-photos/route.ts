import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerName = url.searchParams.get("player");

  let query = supabase.from("spotlight_photos").select("*").order("uploaded_at", { ascending: false });
  if (playerName) {
    query = query.ilike("player_name", playerName);
  }

  const { data, error } = await query.limit(20);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ photos: data || [] });
}

export async function DELETE(request: Request) {
  try {
    const { photoUrl, playerName } = await request.json();
    if (!photoUrl || !playerName) {
      return NextResponse.json({ error: "photoUrl and playerName required" }, { status: 400 });
    }

    const fileName = photoUrl.split("/").pop();
    if (fileName) {
      await supabaseAdmin.storage.from("spotlight-photos").remove([fileName]);
    }

    const { error } = await supabaseAdmin
      .from("spotlight_photos")
      .delete()
      .eq("photo_url", photoUrl)
      .eq("player_name", playerName);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const playerName = formData.get("playerName") as string | null;
    const matchId = formData.get("matchId") as string | null;
    const caption = formData.get("caption") as string | null;

    if (!file || !playerName) {
      return NextResponse.json({ error: "photo and playerName required" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${playerName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from("spotlight-photos")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("spotlight-photos")
      .getPublicUrl(fileName);

    const photoUrl = urlData.publicUrl;

    const { error: dbError } = await supabaseAdmin.from("spotlight_photos").insert({
      player_name: playerName,
      photo_url: photoUrl,
      match_id: matchId || null,
      caption: caption || null,
    });

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, photoUrl });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
