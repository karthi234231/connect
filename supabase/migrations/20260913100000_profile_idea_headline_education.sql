-- Profile Redesign: user-owned headline + idea columns + profile_education table
-- headlines and idea are user-owned introduction fields (see field-ownership.ts);
-- provider_headline (LinkedIn) stays provider-owned and read-only.

-- User-owned introduction headline (distinct from provider_headline)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS headline text;

-- User-owned "What I'm Building" field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS idea text;

-- Provider-sourced education history (twin of profile_experiences)
CREATE TABLE IF NOT EXISTS public.profile_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider_external_id text,
  school text,
  degree text,
  field_of_study text,
  started_at date,
  ended_at date,
  is_current boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'linkedin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_education_user_provider_unique UNIQUE (user_id, provider_external_id)
);

CREATE INDEX IF NOT EXISTS profile_education_user_sort_idx
  ON public.profile_education (user_id, sort_order);

ALTER TABLE public.profile_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own education"
  ON public.profile_education
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER profile_education_touch_updated_at
  BEFORE UPDATE ON public.profile_education
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_education TO authenticated;
GRANT ALL ON public.profile_education TO service_role;
