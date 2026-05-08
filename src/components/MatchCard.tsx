import { Match } from "@/lib/schedule";

export function MatchCard({
  match,
  teamColor,
}: {
  match: Match;
  teamColor?: string;
}) {
  const isResult = !!match.result;

  return (
    <div className="bg-[#222] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-colors">
      <div
        className="h-1"
        style={{ backgroundColor: teamColor || "#6f6f6f" }}
      />
      <div className="px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <span className="text-xs font-[family-name:var(--font-nav)] font-semibold text-[#888] uppercase tracking-wider">
          {match.matchType || "League"}
        </span>
        <div className="text-right">
          <span className="text-xs text-[#a4a4a4]">{match.date}</span>
          {match.time && (
            <span className="text-xs text-[#888] ml-2">{match.time}</span>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-center">
            <p className="font-semibold text-white text-sm">{match.team1}</p>
          </div>
          <div className="text-xs font-bold text-[#555] shrink-0">VS</div>
          <div className="flex-1 text-center">
            <p className="font-semibold text-white text-sm">{match.team2}</p>
          </div>
        </div>
        {match.ground && (
          <p className="text-xs text-[#888] text-center mt-3">{match.ground}</p>
        )}
        {match.division && (
          <p className="text-xs text-[#666] text-center mt-1">
            {match.division}
          </p>
        )}
        {isResult && (
          <div className="mt-3 pt-3 border-t border-[#333]">
            <p className="text-xs text-center text-green-400 font-medium">
              {match.result}
            </p>
          </div>
        )}
        {match.scorecardUrl && (
          <div className="mt-2 text-center">
            <a
              href={match.scorecardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#a4a4a4] hover:text-white transition-colors"
            >
              View Scorecard →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
