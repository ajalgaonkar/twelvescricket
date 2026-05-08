import Link from "next/link";
import { Team } from "@/lib/teams";

export function TeamCard({ team }: { team: Team }) {
  return (
    <Link
      href={`/teams/${team.slug}`}
      className="group block bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1"
    >
      <div className="h-2" style={{ backgroundColor: team.color }} />
      <div className="p-6">
        <h3 className="text-xl font-bold text-slate-800 group-hover:text-slate-900">
          {team.name}
        </h3>
        <p className="mt-2 text-sm text-slate-600">{team.description}</p>
        <div className="mt-4 flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
          View Team
          <svg
            className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
