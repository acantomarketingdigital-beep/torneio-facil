CREATE TABLE IF NOT EXISTS public.registered_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name, category, gender)
);

CREATE INDEX IF NOT EXISTS idx_reg_teams_user_name
  ON public.registered_teams (user_id, lower(name));

ALTER TABLE public.registered_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own registered teams"
  ON public.registered_teams
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
