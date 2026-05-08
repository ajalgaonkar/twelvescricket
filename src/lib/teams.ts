export interface Team {
  slug: string;
  name: string;
  shortName: string;
  teamId: number;
  leagueId: number;
  clubId: number;
  color: string;
  description: string;
}

export const teams: Team[] = [
  {
    slug: "copters",
    name: "Twelves Copters",
    shortName: "Copters",
    teamId: 1455,
    leagueId: 160,
    clubId: 232,
    color: "#1e40af",
    description:
      "Known for their agile gameplay and quick rotations on the field.",
  },
  {
    slug: "drones",
    name: "Twelves Drones",
    shortName: "Drones",
    teamId: 1470,
    leagueId: 161,
    clubId: 232,
    color: "#059669",
    description:
      "Precision and strategy define the Drones' approach to every match.",
  },
  {
    slug: "jets",
    name: "Twelves Jets",
    shortName: "Jets",
    teamId: 1480,
    leagueId: 162,
    clubId: 232,
    color: "#dc2626",
    description:
      "Speed and power — the Jets bring intensity to every encounter.",
  },
  {
    slug: "rockets",
    name: "Twelves Rockets",
    shortName: "Rockets",
    teamId: 1494,
    leagueId: 163,
    clubId: 232,
    color: "#7c3aed",
    description:
      "Explosive batting and fierce bowling make the Rockets a force to reckon with.",
  },
];

export function getTeamBySlug(slug: string): Team | undefined {
  return teams.find((t) => t.slug === slug);
}
