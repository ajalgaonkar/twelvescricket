import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const token = process.env.GITHUB_PAT;
  if (!token) {
    return NextResponse.json({ error: "GitHub PAT not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "live";

  const workflow = mode === "backfill"
    ? "backfill-match-results.yml"
    : "live-scores.yml";

  try {
    const res = await fetch(
      `https://api.github.com/repos/ajalgaonkar/twelvescricket/actions/workflows/${workflow}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (res.status === 204) {
      const message = mode === "backfill"
        ? "Backfill triggered. Results will update in ~5 minutes."
        : "Refresh triggered. Scores will update in ~2 minutes.";
      return NextResponse.json({ success: true, message });
    }

    const body = await res.text();
    return NextResponse.json({ error: "Failed to trigger workflow", details: body }, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
