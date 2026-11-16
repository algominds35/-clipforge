alter table public.projects add column if not exists youtube jsonb;
alter table public.projects add column if not exists analysis jsonb;
alter table public.projects add column if not exists source_video_id uuid references public.videos (id) on delete set null;

alter table public.usage_events alter column job_id drop not null;
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check
  check (kind in ('video_seconds_rendered', 'gemini_video_analysis'));
