-- =============================================================================
-- DMU Academic Hub — Migration 006: Saved Resources
-- =============================================================================

create table if not exists public.saved_resources (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  resource_type text not null check (resource_type in ('book','material','research')),
  resource_id   uuid not null,
  created_at    timestamptz not null default now(),
  unique(user_id, resource_type, resource_id)
);

create index if not exists idx_saved_resources_user on public.saved_resources(user_id);

alter table public.saved_resources enable row level security;

-- Users can only see and manage their own saved resources
create policy "saved_resources: own all"
  on public.saved_resources for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
