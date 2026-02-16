-- Run this in Supabase SQL Editor (Dashboard → SQL Editor) once.
-- Creates tables for workspaces and workspace membership (replaces Prisma/Postgres for dashboard).

-- Profiles (email for notifications; synced on signup)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (true);

-- Workspaces (id = orchestrator workspace id)
create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  stripe_customer_id text,
  stripe_subscription_id text
);

-- Workspace members (user_id = Supabase auth.uid())
create table if not exists public.workspace_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  role text not null default 'operator',
  notify_run_complete boolean not null default false,
  primary key (user_id, workspace_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Users can read workspaces they are members of
create policy "workspaces_select" on public.workspaces
  for select using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = workspaces.id and user_id = auth.uid()
    )
  );

-- Service role can insert/update workspaces (API uses service key on signup)
create policy "workspaces_insert" on public.workspaces for insert with check (true);
create policy "workspaces_update" on public.workspaces for update using (true);

-- Members: users can read their own rows; service can insert/update
create policy "workspace_members_select" on public.workspace_members
  for select using (user_id = auth.uid());
create policy "workspace_members_insert" on public.workspace_members for insert with check (true);
create policy "workspace_members_update" on public.workspace_members
  for update using (user_id = auth.uid());
