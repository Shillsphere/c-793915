-- SECURITY HARDENING MIGRATION (RLS + search_path)
-- --------------------------------------------------
-- 1. Enable Row-Level Security on missing tables
-- 2. Add minimal policies
-- 3. Lock function search_path to `public`
-- --------------------------------------------------

-- 1) ───────────────── RLS ENABLE + POLICIES ─────────────────

-- Waitlist table: users can read their own row (match on email); service_role full access
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Waitlist read own row" ON public.waitlist;
DROP POLICY IF EXISTS "Waitlist service all"   ON public.waitlist;
CREATE POLICY "Waitlist read own row" ON public.waitlist
  FOR SELECT TO authenticated
  USING ( lower(email) = lower(auth.jwt()->>'email') );
CREATE POLICY "Waitlist service all" ON public.waitlist
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- job_logs: no direct user access, service_role only
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_logs deny"   ON public.job_logs;
DROP POLICY IF EXISTS "job_logs service" ON public.job_logs;
CREATE POLICY "job_logs deny"   ON public.job_logs FOR SELECT TO authenticated USING (false);
CREATE POLICY "job_logs service" ON public.job_logs FOR ALL    TO service_role USING (true) WITH CHECK (true);

-- daily_campaign_stats:   same pattern
ALTER TABLE public.daily_campaign_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dcs deny"   ON public.daily_campaign_stats;
DROP POLICY IF EXISTS "dcs service" ON public.daily_campaign_stats;
CREATE POLICY "dcs deny"   ON public.daily_campaign_stats FOR SELECT TO authenticated USING (false);
CREATE POLICY "dcs service" ON public.daily_campaign_stats FOR ALL    TO service_role USING (true) WITH CHECK (true);

-- campaign_executions:    same pattern
ALTER TABLE public.campaign_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ce deny"   ON public.campaign_executions;
DROP POLICY IF EXISTS "ce service" ON public.campaign_executions;
CREATE POLICY "ce deny"   ON public.campaign_executions FOR SELECT TO authenticated USING (false);
CREATE POLICY "ce service" ON public.campaign_executions FOR ALL    TO service_role USING (true) WITH CHECK (true);

-- Fix waitlist_applications policies to allow both anon and authenticated users to insert
DROP POLICY IF EXISTS "Anyone can submit waitlist application" ON public.waitlist_applications;
CREATE POLICY "Anyone can submit waitlist application"
ON public.waitlist_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2) ───────────────── LOCK FUNCTION search_path ─────────────
-- Every call gets an explicit `search_path = public`.

ALTER FUNCTION public.update_updated_at_column()                                  SET search_path TO public;
ALTER FUNCTION public.is_user_accepted_on_waitlist(text)                         SET search_path TO public;
ALTER FUNCTION public.handle_auth_user_signup()                                  SET search_path TO public;
ALTER FUNCTION public.daily_weekly_counts(bigint)                                SET search_path TO public;
ALTER FUNCTION public.get_all_campaign_stats_for_user(uuid)                      SET search_path TO public;
ALTER FUNCTION public.update_daily_stats_from_invites()                          SET search_path TO public;
ALTER FUNCTION public.get_campaigns_ready_for_execution()                        SET search_path TO public;
ALTER FUNCTION public.update_campaign_daily_stats(bigint, integer)               SET search_path TO public;
ALTER FUNCTION public.get_campaign_daily_stats(bigint, integer)                  SET search_path TO public;
ALTER FUNCTION public.get_campaign_execution_summary(bigint)                     SET search_path TO public;
ALTER FUNCTION public.schedule_campaign_next_run(bigint, date)                   SET search_path TO public;
ALTER FUNCTION public.get_user_daily_summary(uuid)                               SET search_path TO public;

-- Done 