ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT NOW() + INTERVAL '10 days',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_subscription_id text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, trial_ends_at, subscription_status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NOW() + INTERVAL '10 days',
    'trial'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
