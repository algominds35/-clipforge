-- ClipForge Phase 1 schema for Supabase Postgres.
-- Apply with the Supabase SQL editor or CLI. Local development uses data/db.json until DATABASE credentials are configured.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  mode text not null default 'streamer' check (mode in ('streamer', 'clipper')),
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  original_filename text not null,
  storage_key text not null,
  duration_seconds numeric not null,
  width integer not null,
  height integer not null,
  video_codec text not null,
  audio_codec text,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  mode text not null check (mode in ('streamer', 'clipper')),
  source_status text not null check (
    source_status in (
      'youtube_metadata_only',
      'video_analysis_available',
      'source_media_available',
      'editing_in_progress',
      'finished_exports_available'
    )
  ),
  timeline jsonb not null default '[]'::jsonb,
  revision integer not null default 1,
  youtube jsonb,
  analysis jsonb,
  source_video_id uuid references public.videos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  type text not null check (type in ('cut')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb not null,
  error text,
  idempotency_key text,
  render_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.renders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  storage_key text not null,
  duration_seconds numeric not null,
  width integer not null,
  height integer not null,
  video_codec text not null,
  audio_codec text,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  kind text not null constraint usage_events_kind_check check (kind in ('video_seconds_rendered', 'gemini_video_analysis')),
  quantity numeric not null,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);

create index if not exists videos_user_id_idx on public.videos (user_id);
create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists jobs_user_id_idx on public.jobs (user_id);
create index if not exists renders_user_id_idx on public.renders (user_id);
create index if not exists usage_events_user_id_idx on public.usage_events (user_id);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.renders enable row level security;
alter table public.usage_events enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy videos_own on public.videos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_own on public.projects
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy jobs_own on public.jobs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy renders_own on public.renders
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy usage_own on public.usage_events
  for select to authenticated using (auth.uid() = user_id);
