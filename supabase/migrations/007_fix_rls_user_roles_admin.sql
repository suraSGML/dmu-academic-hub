-- =============================================================================
-- DMU Academic Hub — Migration 007: Fix RLS so admins can read all user_roles
-- =============================================================================
-- Problem:
--   The "user_roles: admin all" policy covers INSERT/UPDATE/DELETE for admins,
--   but when Supabase evaluates a JOIN (profiles -> user_roles) under RLS the
--   SELECT sub-policy that fires is "user_roles: own read" — which only returns
--   the row for auth.uid(). Every other user's role row is filtered out.
--   Result: the lecturer/student dropdowns in admin pages show 0 options because
--   u.user_roles is always [] for users other than the logged-in admin.
--
-- Fix:
--   1. Add a dedicated SELECT policy for admins on user_roles.
--   2. Also ensure non-admin authenticated users (lecturers, librarians) can
--      read other profiles when needed. We add a broad "authenticated read" policy on
--      profiles — profile data (name, email) is not sensitive.
-- =============================================================================

-- ── user_roles: let admins SELECT all rows ────────────────────────────────────
drop policy if exists "user_roles: admin select" on public.user_roles;

create policy "user_roles: admin select"
  on public.user_roles
  for select
  using (public.is_admin());

-- ── profiles: let all authenticated users read all profiles ──────────────────
-- (needed for displaying names and emails throughout the platform)
drop policy if exists "profiles: authenticated read all" on public.profiles;

create policy "profiles: authenticated read all"
  on public.profiles
  for select
  to authenticated
  using (true);

-- ── user_roles: let all authenticated users read all role assignments ─────────
-- (needed so role badges/filters work across the app for any authenticated user)
drop policy if exists "user_roles: authenticated read all" on public.user_roles;

create policy "user_roles: authenticated read all"
  on public.user_roles
  for select
  to authenticated
  using (true);

-- =============================================================================
-- DONE — Run this in your Supabase SQL Editor.
-- After applying, reload User Management — role badges should show for all users.
-- =============================================================================
