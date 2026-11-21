-- ============================================================================
-- Site updates · Earth Guardians editorial calendar
-- Website page updates: title, slug, HTML content, publish schedule, status.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------- site_updates ----
create table if not exists public.site_updates (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null check (char_length(title) <= 200),
  slug         text        not null unique check (char_length(slug) <= 200),
  content      text        not null, -- HTML page content
  status       text        not null default 'draft'
                 check (status in ('draft','published','archived')),
  published_at timestamptz,          -- when to go live (null = draft)
  url          text,                 -- canonical page URL
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create index if not exists site_updates_status_idx  on public.site_updates (status);
create index if not exists site_updates_slug_idx    on public.site_updates (slug);
create index if not exists site_updates_published_idx on public.site_updates (published_at) where status = 'published';
create index if not exists site_updates_created_idx  on public.site_updates (created_at desc);

-- ------------------------------------------------------------------- RLS ----
alter table public.site_updates enable row level security;

drop policy if exists site_updates_read on public.site_updates;
create policy site_updates_read on public.site_updates
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- No INSERT/UPDATE/DELETE policies: every write goes through the
-- `site-update-save` edge function (service role) after the manager gate.

-- --------------------------------------------------------------- realtime ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_updates'
  ) then
    alter publication supabase_realtime add table public.site_updates;
  end if;
end $$;
