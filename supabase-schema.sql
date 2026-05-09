-- Teams table
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  league_id INTEGER NOT NULL,
  club_id INTEGER NOT NULL,
  color TEXT NOT NULL,
  description TEXT
);

-- Players table
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  team_slug TEXT NOT NULL REFERENCES teams(slug),
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Unknown',
  position TEXT,
  photo_url TEXT,
  profile_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_slug, player_id)
);

-- Player batting stats
CREATE TABLE batting_stats (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  series_type TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  not_outs INTEGER DEFAULT 0,
  runs INTEGER DEFAULT 0,
  balls INTEGER DEFAULT 0,
  average TEXT DEFAULT '0',
  strike_rate TEXT DEFAULT '0',
  high_score TEXT DEFAULT '0',
  hundreds INTEGER DEFAULT 0,
  fifties INTEGER DEFAULT 0,
  fours INTEGER DEFAULT 0,
  sixes INTEGER DEFAULT 0,
  UNIQUE(player_id, team_slug, series_type),
  FOREIGN KEY (team_slug, player_id) REFERENCES players(team_slug, player_id)
);

-- Player bowling stats
CREATE TABLE bowling_stats (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  team_slug TEXT NOT NULL,
  series_type TEXT NOT NULL,
  matches INTEGER DEFAULT 0,
  innings INTEGER DEFAULT 0,
  overs TEXT DEFAULT '0',
  runs INTEGER DEFAULT 0,
  wickets INTEGER DEFAULT 0,
  best_figures TEXT DEFAULT '-',
  maidens INTEGER DEFAULT 0,
  average TEXT DEFAULT '0',
  economy TEXT DEFAULT '0',
  strike_rate TEXT DEFAULT '0',
  four_wickets INTEGER DEFAULT 0,
  five_wickets INTEGER DEFAULT 0,
  catches INTEGER DEFAULT 0,
  UNIQUE(player_id, team_slug, series_type),
  FOREIGN KEY (team_slug, player_id) REFERENCES players(team_slug, player_id)
);

-- Matches table
CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  team_slug TEXT NOT NULL REFERENCES teams(slug),
  match_id TEXT NOT NULL,
  date TEXT,
  time TEXT,
  match_type TEXT,
  series TEXT,
  division TEXT,
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  ground TEXT,
  result TEXT,
  scorecard_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_slug, match_id)
);

-- Indexes
CREATE INDEX idx_players_team ON players(team_slug);
CREATE INDEX idx_batting_player ON batting_stats(player_id, team_slug);
CREATE INDEX idx_bowling_player ON bowling_stats(player_id, team_slug);
CREATE INDEX idx_matches_team ON matches(team_slug);

-- Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE batting_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bowling_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read access" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read access" ON players FOR SELECT USING (true);
CREATE POLICY "Public read access" ON batting_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON bowling_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON matches FOR SELECT USING (true);
