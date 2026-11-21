-- ============================================================================
-- Newsletters · Earth Guardians editorial calendar
-- Email newsletters: subject, HTML body, send schedule, delivery status.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ newsletters ----
create table if not exists public.newsletters (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null check (char_length(title) <= 200),
  subject       text        not null check (char_length(subject) <= 200),
  body          text        not null, -- HTML email body
  status        text        not null default 'draft'
                  check (status in ('draft','scheduled','sent')),
  scheduled_at  timestamptz,            -- when to send (null = send now / draft)
  sent_at       timestamptz,            -- when actually delivered
  recipient_list text       not null default '', -- comma-separated emails
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    text
);

create index if not exists newsletters_status_idx   on public.newsletters (status);
create index if not exists newsletters_scheduled_idx on public.newsletters (scheduled_at) where status = 'scheduled';
create index if not exists newsletters_created_idx  on public.newsletters (created_at desc);

-- ------------------------------------------------------------------- RLS ----
alter table public.newsletters enable row level security;

drop policy if exists newsletters_read on public.newsletters;
create policy newsletters_read on public.newsletters
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- No INSERT/UPDATE/DELETE policies: every write goes through the
-- `newsletter-save` edge function (service role) after the manager gate.

-- --------------------------------------------------------------- realtime ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'newsletters'
  ) then
    alter publication supabase_realtime add table public.newsletters;
  end if;
end $$;
