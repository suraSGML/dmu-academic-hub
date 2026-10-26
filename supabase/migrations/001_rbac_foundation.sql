-- =============================================================================
-- DMU Academic Hub — Migration 001: RBAC Foundation
-- =============================================================================
-- Run this in your Supabase project via SQL Editor (or supabase db push).
-- This migration creates the core RBAC tables, helper functions, RLS policies,
-- and seeds all roles and permissions.
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- SECTION 1: CORE TABLES
-- =============================================================================

-- 1.1 Profiles — 1:1 with auth.users
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text not null,
  avatar_url    text,
  phone         text,
  student_id    text unique,
  staff_id      text unique,
  department_id uuid,   -- FK added in migration 002 after departments table exists
  program_id    uuid,   -- FK added in migration 002
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Extended profile for every auth user. 1:1 with auth.users.';

-- 1.2 Roles
create table if not exists public.roles (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null unique,
  display_name text not null,
  description  text,
  created_at   timestamptz not null default now()
);

comment on table public.roles is 'Application roles: STUDENT, LECTURER, LIBRARIAN, ACADEMIC_LIBRARY_ADMIN.';

-- 1.3 Permissions
create table if not exists public.permissions (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  description text,
  module      text not null,
  created_at  timestamptz not null default now()
);

comment on table public.permissions is 'Granular permission names used in application authorization checks.';

-- 1.4 Role → Permission mapping
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

comment on table public.role_permissions is 'Maps roles to their allowed permissions.';

-- 1.5 User → Role assignment
create table if not exists public.user_roles (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

comment on table public.user_roles is 'Assigns roles to users. A user may have one active role.';

-- 1.6 Notifications
create table if not exists public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  message       text not null,
  type          text not null default 'SYSTEM',
  is_read       boolean not null default false,
  resource_type text,
  resource_id   uuid,
  created_at    timestamptz not null default now()
);

comment on table public.notifications is 'In-app notifications for all users.';

-- 1.7 Audit logs
create table if not exists public.audit_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references public.profiles(id) on delete set null,
  action        text not null,
  resource_type text,
  resource_id   uuid,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz not null default now()
);

comment on table public.audit_logs is 'Immutable audit trail for important platform actions.';

-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

create index if not exists idx_profiles_email        on public.profiles(email);
create index if not exists idx_user_roles_user_id    on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id    on public.user_roles(role_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_is_read on public.notifications(user_id, is_read);
create index if not exists idx_audit_logs_user_id    on public.audit_logs(user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGER
-- =============================================================================

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- SECTION 4: AUTO-CREATE PROFILE ON SIGN-UP
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_student_role_id uuid;
begin
  -- Insert profile
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  -- Auto-assign STUDENT role as default
  select id into v_student_role_id from public.roles where name = 'STUDENT';
  if v_student_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, v_student_role_id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- SECTION 5: HELPER FUNCTIONS (used inside RLS policies)
-- =============================================================================

-- Returns the primary role name for a given user
create or replace function public.get_user_role(p_user_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select r.name
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = p_user_id
  limit 1;
$$;

grant execute on function public.get_user_role(uuid) to authenticated;
grant execute on function public.get_user_role(uuid) to anon;

-- Returns true if the user has the specified permission
create or replace function public.has_permission(p_user_id uuid, p_permission_name text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p       on p.id = rp.permission_id
    where ur.user_id    = p_user_id
      and p.name        = p_permission_name
  );
$$;

grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.has_permission(uuid, text) to anon;

-- Returns true if the current session user is an ACADEMIC_LIBRARY_ADMIN
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select public.get_user_role(auth.uid()) = 'ACADEMIC_LIBRARY_ADMIN';
$$;

-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
alter table public.profiles          enable row level security;
alter table public.roles             enable row level security;
alter table public.permissions       enable row level security;
alter table public.role_permissions  enable row level security;
alter table public.user_roles        enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_logs        enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────
-- Users can read and update their own profile
drop policy if exists "profiles: own read"   on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;
drop policy if exists "profiles: admin read" on public.profiles;

create policy "profiles: own read"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: own update"
  on public.profiles for update
  using (id = auth.uid());

-- Admins can read all profiles (for user management)
create policy "profiles: admin read"
  on public.profiles for select
  using (public.is_admin());

-- Service role (used by triggers/functions) can insert
create policy "profiles: service insert"
  on public.profiles for insert
  with check (true);  -- restricted to service role key via RLS bypass

-- ── roles ─────────────────────────────────────────────────────────────────────
-- All authenticated users can read roles (needed for UI role display)
drop policy if exists "roles: authenticated read" on public.roles;

create policy "roles: authenticated read"
  on public.roles for select
  to authenticated
  using (true);

-- ── permissions ───────────────────────────────────────────────────────────────
drop policy if exists "permissions: authenticated read" on public.permissions;

create policy "permissions: authenticated read"
  on public.permissions for select
  to authenticated
  using (true);

-- ── role_permissions ──────────────────────────────────────────────────────────
drop policy if exists "role_permissions: authenticated read" on public.role_permissions;

create policy "role_permissions: authenticated read"
  on public.role_permissions for select
  to authenticated
  using (true);

-- ── user_roles ────────────────────────────────────────────────────────────────
drop policy if exists "user_roles: own read"   on public.user_roles;
drop policy if exists "user_roles: admin all"  on public.user_roles;

-- Users can see their own role assignments
create policy "user_roles: own read"
  on public.user_roles for select
  using (user_id = auth.uid());

-- Admins can fully manage role assignments
create policy "user_roles: admin all"
  on public.user_roles for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── notifications ─────────────────────────────────────────────────────────────
drop policy if exists "notifications: own read"   on public.notifications;
drop policy if exists "notifications: own update" on public.notifications;
drop policy if exists "notifications: admin read" on public.notifications;

create policy "notifications: own read"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications: own update"
  on public.notifications for update
  using (user_id = auth.uid());

-- Allow system/service to insert notifications
create policy "notifications: service insert"
  on public.notifications for insert
  with check (true);

-- Admins can read all notifications for oversight
create policy "notifications: admin read"
  on public.notifications for select
  using (public.is_admin());

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Only admins can read audit logs
drop policy if exists "audit_logs: admin read"     on public.audit_logs;
drop policy if exists "audit_logs: service insert" on public.audit_logs;

create policy "audit_logs: admin read"
  on public.audit_logs for select
  using (public.is_admin());

-- Allow application to insert audit events
create policy "audit_logs: service insert"
  on public.audit_logs for insert
  with check (true);

-- =============================================================================
-- SECTION 7: SEED ROLES
-- =============================================================================

insert into public.roles (name, display_name, description) values
  ('STUDENT',               'Student',                                       'DMU enrolled student'),
  ('LECTURER',              'Lecturer',                                      'DMU academic staff / lecturer'),
  ('LIBRARIAN',             'Librarian',                                     'DMU library staff member'),
  ('ACADEMIC_LIBRARY_ADMIN','Academic Resource & Library Administrator',     'Administration of the academic resource and library platform')
on conflict (name) do update set
  display_name = excluded.display_name,
  description  = excluded.description;

-- =============================================================================
-- SECTION 8: SEED PERMISSIONS
-- =============================================================================

insert into public.permissions (name, module, description) values
  -- Dashboard
  ('VIEW_DASHBOARD',          'dashboard',   'Access own role dashboard'),
  -- Courses
  ('VIEW_COURSE',             'courses',     'View course information'),
  ('VIEW_COURSE_MATERIAL',    'courses',     'View course materials'),
  ('DOWNLOAD_MATERIAL',       'courses',     'Download course materials'),
  ('UPLOAD_MATERIAL',         'courses',     'Upload course materials to assigned courses'),
  ('EDIT_OWN_MATERIAL',       'courses',     'Edit own uploaded materials'),
  ('DELETE_OWN_MATERIAL',     'courses',     'Delete own uploaded materials'),
  ('PUBLISH_MATERIAL',        'courses',     'Publish/unpublish own materials'),
  ('MANAGE_ALL_MATERIALS',    'courses',     'Manage all materials on the platform'),
  -- Library
  ('VIEW_LIBRARY',            'library',     'Browse the library catalogue'),
  ('BORROW_BOOK',             'library',     'Borrow books from the library'),
  ('RETURN_BOOK',             'library',     'Return borrowed books'),
  ('RESERVE_BOOK',            'library',     'Reserve unavailable books'),
  ('VIEW_BORROWING_HISTORY',  'library',     'View own borrowing history'),
  ('MANAGE_BOOK',             'library',     'Create and manage book records'),
  ('MANAGE_BOOK_COPY',        'library',     'Manage individual book copies'),
  ('PROCESS_BORROWING',       'library',     'Process borrowing transactions'),
  ('PROCESS_RETURN',          'library',     'Process book returns'),
  ('MANAGE_RESERVATION',      'library',     'Manage book reservations'),
  ('MANAGE_OVERDUE',          'library',     'Manage overdue books and fines'),
  ('GENERATE_QR',             'library',     'Generate QR codes for book copies'),
  ('SCAN_QR',                 'library',     'Scan QR codes for library operations'),
  ('VIEW_LIBRARY_REPORTS',    'library',     'View library usage reports'),
  -- Research
  ('VIEW_RESEARCH',           'research',    'View research resources'),
  ('UPLOAD_RESEARCH',         'research',    'Upload research resources'),
  ('EDIT_OWN_RESEARCH',       'research',    'Edit own research submissions'),
  ('APPROVE_RESEARCH',        'research',    'Approve or reject research submissions'),
  ('MANAGE_RESEARCH',         'research',    'Manage all research resources'),
  -- Administration
  ('MANAGE_USERS',            'admin',       'Manage platform users'),
  ('MANAGE_ROLES',            'admin',       'Manage role assignments'),
  ('VIEW_AUDIT_LOGS',         'admin',       'View platform audit logs'),
  ('MANAGE_SETTINGS',         'admin',       'Manage platform settings'),
  -- Analytics
  ('VIEW_OWN_ANALYTICS',      'analytics',   'View own usage analytics'),
  ('VIEW_LIBRARY_ANALYTICS',  'analytics',   'View library-wide analytics'),
  ('VIEW_PLATFORM_ANALYTICS', 'analytics',   'View platform-wide analytics')
on conflict (name) do nothing;

-- =============================================================================
-- SECTION 9: SEED ROLE → PERMISSION MAPPINGS
-- =============================================================================

-- Assign permissions using a direct insert from role/permission name joins
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where
  (r.name = 'STUDENT' and p.name in (
    'VIEW_DASHBOARD','VIEW_COURSE','VIEW_COURSE_MATERIAL','DOWNLOAD_MATERIAL',
    'VIEW_LIBRARY','BORROW_BOOK','RETURN_BOOK','RESERVE_BOOK','VIEW_BORROWING_HISTORY',
    'VIEW_RESEARCH','VIEW_OWN_ANALYTICS'
  ))
  or
  (r.name = 'LECTURER' and p.name in (
    'VIEW_DASHBOARD','VIEW_COURSE','VIEW_COURSE_MATERIAL','DOWNLOAD_MATERIAL',
    'UPLOAD_MATERIAL','EDIT_OWN_MATERIAL','DELETE_OWN_MATERIAL','PUBLISH_MATERIAL',
    'VIEW_LIBRARY','BORROW_BOOK','RETURN_BOOK','VIEW_BORROWING_HISTORY',
    'VIEW_RESEARCH','UPLOAD_RESEARCH','EDIT_OWN_RESEARCH','VIEW_OWN_ANALYTICS'
  ))
  or
  (r.name = 'LIBRARIAN' and p.name in (
    'VIEW_DASHBOARD','VIEW_LIBRARY','BORROW_BOOK','RETURN_BOOK','RESERVE_BOOK',
    'VIEW_BORROWING_HISTORY','MANAGE_BOOK','MANAGE_BOOK_COPY','PROCESS_BORROWING',
    'PROCESS_RETURN','MANAGE_RESERVATION','MANAGE_OVERDUE','GENERATE_QR','SCAN_QR',
    'VIEW_LIBRARY_REPORTS','VIEW_LIBRARY_ANALYTICS'
  ))
  or
  (r.name = 'ACADEMIC_LIBRARY_ADMIN' and p.name in (
    'VIEW_DASHBOARD','VIEW_COURSE','VIEW_COURSE_MATERIAL','DOWNLOAD_MATERIAL',
    'UPLOAD_MATERIAL','EDIT_OWN_MATERIAL','DELETE_OWN_MATERIAL','PUBLISH_MATERIAL','MANAGE_ALL_MATERIALS',
    'VIEW_LIBRARY','BORROW_BOOK','RETURN_BOOK','RESERVE_BOOK','VIEW_BORROWING_HISTORY',
    'MANAGE_BOOK','MANAGE_BOOK_COPY','PROCESS_BORROWING','PROCESS_RETURN',
    'MANAGE_RESERVATION','MANAGE_OVERDUE','GENERATE_QR','SCAN_QR','VIEW_LIBRARY_REPORTS',
    'VIEW_RESEARCH','UPLOAD_RESEARCH','EDIT_OWN_RESEARCH','APPROVE_RESEARCH','MANAGE_RESEARCH',
    'MANAGE_USERS','MANAGE_ROLES','VIEW_AUDIT_LOGS','MANAGE_SETTINGS',
    'VIEW_OWN_ANALYTICS','VIEW_LIBRARY_ANALYTICS','VIEW_PLATFORM_ANALYTICS'
  ))
on conflict do nothing;

-- =============================================================================
-- DONE
-- =============================================================================
-- After running this migration:
-- 1. Create test users via Supabase Auth dashboard (Authentication > Users > Add user)
-- 2. Check profiles table — a row should be auto-created for each user
-- 3. Update user_roles to assign non-student roles:
--    UPDATE public.user_roles SET role_id = (SELECT id FROM roles WHERE name = 'LECTURER')
--    WHERE user_id = '<user-uuid>';
-- 4. Verify get_user_role('<uuid>') returns the correct role
-- =============================================================================
