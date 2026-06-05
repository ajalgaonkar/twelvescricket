import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const teamColors: Record<string, string> = {
  copters: "#1e40af",
  drones: "#059669",
  jets: "#dc2626",
  rockets: "#7c3aed",
  "unknown-twelves": "#f59e0b",
};

const teams = [
  { slug: "copters", teamId: 1455, leagueId: 160, clubId: 232 },
  { slug: "drones", teamId: 1470, leagueId: 161, clubId: 232 },
  { slug: "jets", teamId: 1480, leagueId: 162, clubId: 232 },
  { slug: "rockets", teamId: 1494, leagueId: 163, clubId: 232 },
];

interface LiveMatchData {
  matchId: string;
  teamSlug: string;
  team1Name: string;
  team1Score: string;
  team1Overs: string;
  team2Name: string;
  team2Score: string;
  team2Overs: string;
  statusText: string;
  isLive: boolean;
  isCompleted: boolean;
  battingNow: { name: string; runs: string; balls: string; fours: string; sixes: string; sr: string }[];
  bowlingNow: { name: string; overs: string; maidens: string; runs: string; wickets: string; econ: string }[];
  scorecardUrl: string;
}

async function scrapeScorecard(url: string): Promise<Omit<LiveMatchData, "matchId" | "teamSlug" | "scorecardUrl"> | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();

    if (html.includes("Just a moment") || html.length < 10000) return null;

    const $ = cheerio.load(html);
    const matchSummary = $(".match-summary");
    if (!matchSummary.length) return null;

    const teamItems = matchSummary.find("ul.list-inline li.win");
    if (teamItems.length < 2) return null;

    const team1Name = $(teamItems[0]).find(".teamName").text().trim();
    const team1Score = $(teamItems[0]).find("span:not(.teamName)").text().trim();
    const team1Overs = $(teamItems[0]).find("p").text().trim();
    const team2Name = $(teamItems[1]).find(".teamName").text().trim();
    const team2Score = $(teamItems[1]).find("span:not(.teamName)").text().trim();
    const team2Overs = $(teamItems[1]).find("p").text().trim();

    if (!team1Score && !team2Score) return null;

    const statusH3 = $(".score-top .container h3").first();
    const statusText = statusH3.text().trim().replace(/DLS.*$/, "").trim();
    const statusLower = statusText.toLowerCase();

    const isLive =
      statusLower.includes("runs needed") ||
      statusLower.includes("wickets remaining") ||
      statusLower.includes("overs remaining");
    const isCompleted =
      statusLower.includes("won") ||
      statusLower.includes("tied") ||
      statusLower.includes("draw") ||
      statusLower.includes("no result");

    // Current batters
    const battingNow: LiveMatchData["battingNow"] = [];
    $("table").each((_, table) => {
      const firstCell = $(table).find("th, td").first().text().trim();
      if (firstCell === "Batter" && battingNow.length === 0) {
        $(table).find("tr").each((_, row) => {
          const cells = $(row).find("th, td");
          if (cells.length >= 6) {
            const name = $(cells[0]).text().trim();
            if (name && name !== "Batter") {
              battingNow.push({
                name,
                runs: $(cells[1]).text().trim(),
                balls: $(cells[2]).text().trim(),
                fours: $(cells[3]).text().trim(),
                sixes: $(cells[4]).text().trim(),
                sr: $(cells[5]).text().trim(),
              });
            }
          }
        });
      }
    });

    // Current bowlers
    const bowlingNow: LiveMatchData["bowlingNow"] = [];
    $("table").each((_, table) => {
      const firstCell = $(table).find("th, td").first().text().trim();
      if (firstCell === "Bowler" && bowlingNow.length === 0) {
        $(table).find("tr").each((_, row) => {
          const cells = $(row).find("th, td");
          if (cells.length >= 6) {
            const name = $(cells[0]).text().trim();
            if (name && name !== "Bowler") {
              bowlingNow.push({
                name,
                overs: $(cells[1]).text().trim(),
                maidens: $(cells[2]).text().trim(),
                runs: $(cells[3]).text().trim(),
                wickets: $(cells[4]).text().trim(),
                econ: $(cells[5]).text().trim(),
              });
            }
          }
        });
      }
    });

    return { team1Name, team1Score, team1Overs, team2Name, team2Score, team2Overs, statusText, isLive, isCompleted, battingNow, bowlingNow };
  } catch {
    return null;
  }
}

async function scrapeTeamScheduleForScorecards(teamSlug: string, teamId: number, leagueId: number, clubId: number): Promise<{ matchId: string; url: string }[]> {
  try {
    const url = `https://cricclubs.com/NWCL/teamSchedule.do?teamId=${teamId}&league=${leagueId}&clubId=${clubId}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });
    const html = await res.text();
    if (html.includes("Just a moment") || html.length < 5000) return [];

    const $ = cheerio.load(html);
    const links: { matchId: string; url: string }[] = [];

    $("#attTable tbody tr").each((_, row) => {
      const scorecardLink = $(row).find('a[href*="viewScorecard"]');
      if (scorecardLink.length) {
        const href = scorecardLink.attr("href") || "";
        const matchIdMatch = href.match(/matchId=(\d+)/);
        if (matchIdMatch) {
          links.push({
            matchId: matchIdMatch[1],
            url: `https://cricclubs.com${href}`,
          });
        }
      }
    });

    // Return only the last 2 (most recent)
    return links.slice(-2);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh");
  const authHeader = request.headers.get("authorization");

  // If refresh is requested (via cron or manual trigger), scrape live data
  if (refresh === "true") {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const liveResults: LiveMatchData[] = [];

    for (const team of teams) {
      const scorecardLinks = await scrapeTeamScheduleForScorecards(team.slug, team.teamId, team.leagueId, team.clubId);

      for (const link of scorecardLinks) {
        const data = await scrapeScorecard(link.url);
        if (data) {
          liveResults.push({
            matchId: link.matchId,
            teamSlug: team.slug,
            scorecardUrl: link.url,
            ...data,
          });
        }
      }
    }

    // Store in live_scores table (upsert only — never delete old results)
    for (const lr of liveResults) {
      await supabaseAdmin.from("live_scores").upsert(
        {
          match_id: lr.matchId,
          team_slug: lr.teamSlug,
          team1_name: lr.team1Name,
          team1_score: lr.team1Score,
          team1_overs: lr.team1Overs,
          team2_name: lr.team2Name,
          team2_score: lr.team2Score,
          team2_overs: lr.team2Overs,
          status_text: lr.statusText,
          is_live: lr.isLive,
          batting_now: lr.battingNow,
          bowling_now: lr.bowlingNow,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "match_id" }
      );
    }

    // Remove entries older than 7 days to avoid stale data buildup
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("live_scores").delete().lt("updated_at", weekAgo);

    return NextResponse.json({
      success: true,
      scraped: liveResults.length,
      matches: liveResults.map((lr) => ({
        matchId: lr.matchId,
        team1: lr.team1Name,
        team2: lr.team2Name,
        isLive: lr.isLive,
      })),
    });
  }

  // Default: serve live + upcoming match data
  try {
    const results: any[] = [];

    // 1. Try to read live scores from DB
    try {
      const { data: liveScores } = await supabase
        .from("live_scores")
        .select("*")
        .order("updated_at", { ascending: false });

      if (liveScores && liveScores.length > 0) {
        for (const ls of liveScores) {
          const statusLower = (ls.status_text || "").toLowerCase();
          const hasScores = !!(ls.team1_score || ls.team2_score);

          // Determine match status
          const isCompletedByStatus =
            statusLower.includes("won") ||
            statusLower.includes("tied") ||
            statusLower.includes("draw") ||
            statusLower.includes("no result");

          // Detect completed matches even if status text hasn't updated:
          // If both teams have scores with "/10" (all out) or the chasing team passed target
          const t1Score = ls.team1_score || "";
          const t2Score = ls.team2_score || "";
          const t1AllOut = t1Score.includes("/10");
          const t2AllOut = t2Score.includes("/10");
          const t1Runs = parseInt(t1Score) || 0;
          const t2Runs = parseInt(t2Score) || 0;
          const bothBatted = !!(t1Score && t2Score);
          const chaseComplete = bothBatted && (t2Runs > t1Runs || t2AllOut);
          const isCompleted = isCompletedByStatus || chaseComplete;

          // Truly live: explicitly marked OR has scores and not completed
          const isLive = ls.is_live || (hasScores && !isCompleted);

          results.push({
            matchId: ls.match_id,
            team1: ls.team1_name || "",
            team2: ls.team2_name || "",
            date: null,
            time: null,
            matchType: null,
            ground: null,
            result: isCompleted ? ls.status_text : null,
            scorecardUrl: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${ls.match_id}&clubId=232`,
            teamSlug: ls.team_slug,
            teamColor: teamColors[ls.team_slug] || "#666",
            status: isLive ? "live" : isCompleted ? "completed" : "upcoming",
            liveData: {
              team1Score: ls.team1_score || "",
              team1Overs: ls.team1_overs || "",
              team2Score: ls.team2_score || "",
              team2Overs: ls.team2_overs || "",
              statusText: ls.status_text || "",
              battingNow: ls.batting_now || [],
              bowlingNow: ls.bowling_now || [],
            },
          });
        }
      }
    } catch {
      // live_scores table may not exist yet — fall through to upcoming
    }

    // 2. Get upcoming matches from the matches table
    const { data: matches } = await supabase
      .from("matches")
      .select("*")
      .order("date", { ascending: true });

    if (matches) {
      const now = new Date();
      const todayStr = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;

      const upcoming = matches.filter((m) => {
        if (!m.date) return false;
        return m.date >= todayStr && !m.result;
      });

      for (const m of upcoming.slice(0, 6)) {
        // Skip if we already have live data for this match
        const alreadyHaveLive = results.some(
          (r) => r.team1 === m.team1 && r.team2 === m.team2
        );
        if (alreadyHaveLive) continue;

        results.push({
          matchId: m.match_id,
          team1: m.team1,
          team2: m.team2,
          date: m.date,
          time: m.time,
          matchType: m.match_type,
          ground: m.ground,
          result: null,
          scorecardUrl: `https://cricclubs.com/NWCL/viewScorecard.do?matchId=${m.match_id}&clubId=232`,
          teamSlug: m.team_slug,
          teamColor: teamColors[m.team_slug] || "#666",
          status: "upcoming",
          liveData: null,
        });
      }
    }

    // Sort: live first, then upcoming, then completed
    const statusOrder: Record<string, number> = { live: 0, upcoming: 1, completed: 2 };
    results.sort((a, b) => {
      const aOrder = statusOrder[a.status] ?? 2;
      const bOrder = statusOrder[b.status] ?? 2;
      return aOrder - bOrder;
    });

    return NextResponse.json({ matches: results.slice(0, 12) });
  } catch {
    return NextResponse.json({ matches: [] }, { status: 500 });
  }
}
