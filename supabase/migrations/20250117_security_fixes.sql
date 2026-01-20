-- Security Fixes Migration
-- Fixes RLS and security issues flagged by Supabase

-- 1. Enable RLS on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on public.category_keywords (read-only reference table)
ALTER TABLE public.category_keywords ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read category_keywords
CREATE POLICY "Anyone can read category_keywords"
  ON public.category_keywords FOR SELECT
  USING (true);

-- 3. Enable RLS on public.grocery_categories (read-only reference table)
ALTER TABLE public.grocery_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read grocery_categories
CREATE POLICY "Anyone can read grocery_categories"
  ON public.grocery_categories FOR SELECT
  USING (true);

-- 4. Fix admin views - drop SECURITY DEFINER and recreate as regular views
-- These views should only be accessible via service role key anyway

-- Drop and recreate admin_daily_signups without exposing auth.users
DROP VIEW IF EXISTS public.admin_daily_signups;

CREATE VIEW public.admin_daily_signups AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as signups
FROM public.users
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Secure the view
ALTER VIEW public.admin_daily_signups SET (security_invoker = true);

-- Drop and recreate admin_error_summary
DROP VIEW IF EXISTS public.admin_error_summary;

CREATE VIEW public.admin_error_summary AS
SELECT
  DATE(created_at) as date,
  error_type,
  COUNT(*) as count
FROM public.error_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), error_type
ORDER BY date DESC, count DESC;

-- Secure the view
ALTER VIEW public.admin_error_summary SET (security_invoker = true);

-- Drop and recreate admin_subscription_stats
DROP VIEW IF EXISTS public.admin_subscription_stats;

CREATE VIEW public.admin_subscription_stats AS
SELECT
  tier,
  status,
  billing_interval,
  COUNT(*) as count
FROM public.subscriptions
GROUP BY tier, status, billing_interval;

-- Secure the view
ALTER VIEW public.admin_subscription_stats SET (security_invoker = true);

-- 5. Ensure users table has proper policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

-- Create proper policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT SELECT ON public.category_keywords TO authenticated;
GRANT SELECT ON public.grocery_categories TO authenticated;
