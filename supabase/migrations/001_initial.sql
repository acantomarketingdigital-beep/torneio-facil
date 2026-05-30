-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- CHAMPIONSHIPS
-- =============================================
CREATE TABLE championships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'Futebol',
  format TEXT NOT NULL DEFAULT 'round_robin',
  -- round_robin | knockout | group_knockout | custom
  status TEXT NOT NULL DEFAULT 'draft',
  -- draft | published | in_progress | finished
  slug TEXT UNIQUE,
  description TEXT,
  logo_url TEXT,
  location TEXT,
  start_date DATE,
  end_date DATE,
  game_duration INTEGER NOT NULL DEFAULT 60,
  interval_between_games INTEGER NOT NULL DEFAULT 15,
  min_rest_minutes INTEGER NOT NULL DEFAULT 120,
  max_games_per_day_per_team INTEGER NOT NULL DEFAULT 2,
  custom_games_per_team INTEGER DEFAULT 3,
  points_win INTEGER NOT NULL DEFAULT 3,
  points_draw INTEGER NOT NULL DEFAULT 1,
  points_loss INTEGER NOT NULL DEFAULT 0,
  tiebreaker_order TEXT[] NOT NULL DEFAULT ARRAY['points','wins','goal_difference','goals_for','head_to_head'],
  allow_draws BOOLEAN NOT NULL DEFAULT TRUE,
  groups_count INTEGER DEFAULT 4,
  teams_advance_per_group INTEGER DEFAULT 2,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  regulation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE championships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage championships" ON championships
  USING (auth.uid() = owner_id);
CREATE POLICY "Public championships visible" ON championships
  FOR SELECT USING (is_public = TRUE OR auth.uid() = owner_id);

-- =============================================
-- TEAMS
-- =============================================
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  logo_url TEXT,
  color TEXT DEFAULT '#3B82F6',
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  seed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Championship members see teams" ON teams FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage teams" ON teams FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- VENUES (Quadras/Campos)
-- =============================================
CREATE TABLE venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Championship members see venues" ON venues FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage venues" ON venues FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- AVAILABLE SLOTS
-- =============================================
CREATE TABLE available_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public slots visible" ON available_slots FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage slots" ON available_slots FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- GROUPS (For group_knockout format)
-- =============================================
CREATE TABLE groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  teams_advance INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public groups visible" ON groups FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage groups" ON groups FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- GROUP_TEAMS
-- =============================================
CREATE TABLE group_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(group_id, team_id)
);

ALTER TABLE group_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public group teams visible" ON group_teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN championships c ON c.id = g.championship_id
      WHERE g.id = group_id AND (c.is_public OR c.owner_id = auth.uid())
    )
  );
CREATE POLICY "Owners manage group teams" ON group_teams FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN championships c ON c.id = g.championship_id
      WHERE g.id = group_id AND c.owner_id = auth.uid()
    )
  );

-- =============================================
-- MATCHES
-- =============================================
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  round INTEGER,
  round_name TEXT,
  phase TEXT NOT NULL DEFAULT 'group',
  -- group | round_of_16 | quarter_final | semi_final | third_place | final
  home_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  scheduled_date DATE,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- scheduled | in_progress | finished | cancelled | walkover
  home_score INTEGER,
  away_score INTEGER,
  winner_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  notes TEXT,
  match_order INTEGER DEFAULT 0,
  parent_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  parent_slot TEXT,
  -- home | away (which slot this match winner goes to in parent)
  is_manual BOOLEAN NOT NULL DEFAULT FALSE,
  bye_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public matches visible" ON matches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage matches" ON matches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- STANDINGS
-- =============================================
CREATE TABLE standings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID REFERENCES championships(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER GENERATED ALWAYS AS (goals_for - goals_against) STORED,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(championship_id, group_id, team_id)
);

ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public standings visible" ON standings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND (c.is_public OR c.owner_id = auth.uid()))
  );
CREATE POLICY "Owners manage standings" ON standings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM championships c WHERE c.id = championship_id AND c.owner_id = auth.uid())
  );

-- =============================================
-- FUNCTIONS
-- =============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER championships_updated_at BEFORE UPDATE ON championships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER standings_updated_at BEFORE UPDATE ON standings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate unique slug
CREATE OR REPLACE FUNCTION generate_championship_slug(name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  final_slug := base_slug || '-' || floor(random() * 9000 + 1000)::TEXT;
  WHILE EXISTS (SELECT 1 FROM championships WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || floor(random() * 9000 + 1000)::TEXT;
    IF counter > 100 THEN
      final_slug := base_slug || '-' || extract(epoch FROM NOW())::BIGINT::TEXT;
      EXIT;
    END IF;
  END LOOP;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Recalculate standings for a championship
CREATE OR REPLACE FUNCTION recalculate_standings(p_championship_id UUID)
RETURNS VOID AS $$
DECLARE
  v_champ RECORD;
BEGIN
  SELECT * INTO v_champ FROM championships WHERE id = p_championship_id;

  -- Delete and rebuild standings
  DELETE FROM standings WHERE championship_id = p_championship_id;

  -- For group phases, calculate per group
  INSERT INTO standings (championship_id, group_id, team_id, played, wins, draws, losses, goals_for, goals_against, points)
  SELECT
    m.championship_id,
    m.group_id,
    t.id AS team_id,
    COUNT(CASE WHEN m.status = 'finished' THEN 1 END) AS played,
    COUNT(CASE WHEN m.status = 'finished' AND m.winner_id = t.id THEN 1 END) AS wins,
    COUNT(CASE WHEN m.status = 'finished' AND m.winner_id IS NULL AND m.home_score IS NOT NULL THEN 1 END) AS draws,
    COUNT(CASE WHEN m.status = 'finished' AND m.winner_id IS NOT NULL AND m.winner_id != t.id THEN 1 END) AS losses,
    COALESCE(SUM(CASE WHEN m.status = 'finished' AND m.home_team_id = t.id THEN m.home_score
                      WHEN m.status = 'finished' AND m.away_team_id = t.id THEN m.away_score ELSE 0 END), 0) AS goals_for,
    COALESCE(SUM(CASE WHEN m.status = 'finished' AND m.home_team_id = t.id THEN m.away_score
                      WHEN m.status = 'finished' AND m.away_team_id = t.id THEN m.home_score ELSE 0 END), 0) AS goals_against,
    (
      COUNT(CASE WHEN m.status = 'finished' AND m.winner_id = t.id THEN 1 END) * v_champ.points_win +
      COUNT(CASE WHEN m.status = 'finished' AND m.winner_id IS NULL AND m.home_score IS NOT NULL THEN 1 END) * v_champ.points_draw +
      COUNT(CASE WHEN m.status = 'finished' AND m.winner_id IS NOT NULL AND m.winner_id != t.id THEN 1 END) * v_champ.points_loss
    ) AS points
  FROM teams t
  JOIN matches m ON (m.home_team_id = t.id OR m.away_team_id = t.id)
  WHERE t.championship_id = p_championship_id
    AND m.championship_id = p_championship_id
    AND m.phase IN ('group', 'round_robin')
  GROUP BY m.championship_id, m.group_id, t.id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX idx_championships_owner ON championships(owner_id);
CREATE INDEX idx_championships_slug ON championships(slug);
CREATE INDEX idx_teams_championship ON teams(championship_id);
CREATE INDEX idx_venues_championship ON venues(championship_id);
CREATE INDEX idx_matches_championship ON matches(championship_id);
CREATE INDEX idx_matches_phase ON matches(championship_id, phase);
CREATE INDEX idx_matches_round ON matches(championship_id, round);
CREATE INDEX idx_matches_date ON matches(scheduled_date);
CREATE INDEX idx_standings_championship ON standings(championship_id);
CREATE INDEX idx_available_slots_championship ON available_slots(championship_id);
