-- ============================================================================
-- Workspace · Email threads · Commentaries · Notifications
-- Earth Guardians Social Media Director Control
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================ workspace ====
-- A "workspace" is a named container that groups any calendar item
-- (post | newsletter | site_update) together with its discussion,
-- email threads and notes in one place.
create table if not exists public.workspaces (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null check (char_length(title) <= 300),
  description  text        not null default '',
  -- Which calendar item this workspace is primarily about (optional).
  item_kind    text        check (item_kind in ('post','newsletter','site_update')),
  item_id      uuid,       -- FK is soft (the referenced table varies by kind)
  status       text        not null default 'active'
                 check (status in ('active','archived')),
  pinned       boolean     not null default false,
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create index if not exists workspaces_item_idx    on public.workspaces (item_kind, item_id);
create index if not exists workspaces_status_idx  on public.workspaces (status);
create index if not exists workspaces_created_idx on public.workspaces (created_at desc);

-- ======================================================== email_threads ====
-- Each workspace can have multiple email threads.  A thread stores the
-- initiating message; replies are rows with parent_id set.
create table if not exists public.email_threads (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null
                 references public.workspaces (id) on delete cascade,
  parent_id    uuid        references public.email_threads (id) on delete cascade,
  -- Either 'initiator' (new outbound thread) or 'attached' (import existing).
  thread_type  text        not null default 'initiator'
                 check (thread_type in ('initiator','attached')),
  subject      text        not null check (char_length(subject) <= 300),
  body         text        not null,
  from_address text        not null,
  to_addresses text        not null default '', -- comma-separated
  cc_addresses text        not null default '',
  -- External message-id for attached / imported threads.
  external_message_id text,
  sent_at      timestamptz,
  status       text        not null default 'draft'
                 check (status in ('draft','sent','received','archived')),
  created_by   text        not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists email_threads_workspace_idx on public.email_threads (workspace_id, created_at);
create index if not exists email_threads_parent_idx    on public.email_threads (parent_id);
create index if not exists email_threads_status_idx    on public.email_threads (status);

-- ========================================================== commentaries ====
-- Global commentary system.  Any piece of UI can be annotated by passing a
-- (target_type, target_id, target_path) tuple that describes what is being
-- commented on (a post, an image, a newsletter section, etc.).
create table if not exists public.commentaries (
  id           uuid        primary key default gen_random_uuid(),
  -- Where this comment lives:
  --   'post' | 'newsletter' | 'site_update' | 'workspace' | 'image' | 'general'
  target_type  text        not null default 'general',
  -- UUID of the specific row being commented on (null for general/page-level).
  target_id    uuid,
  -- Optional free-form path inside the target, e.g. "image" or "caption".
  target_path  text        not null default '',
  -- Parent for threaded replies inside a commentary.
  parent_id    uuid        references public.commentaries (id) on delete cascade,
  body         text        not null check (char_length(body) <= 10000),
  author_email text        not null,
  author_name  text        not null default '',
  -- Resolved = the discussion is closed / addressed.
  resolved     boolean     not null default false,
  resolved_by  text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists commentaries_target_idx   on public.commentaries (target_type, target_id);
create index if not exists commentaries_parent_idx   on public.commentaries (parent_id);
create index if not exists commentaries_resolved_idx on public.commentaries (resolved);
create index if not exists commentaries_created_idx  on public.commentaries (created_at desc);

-- Extracted tags (@email mentions) from each commentary body.
-- Populated by the `comment-save` edge function; never edited directly.
create table if not exists public.commentary_tags (
  id             uuid        primary key default gen_random_uuid(),
  commentary_id  uuid        not null
                   references public.commentaries (id) on delete cascade,
  tagged_email   text        not null,
  notified_at    timestamptz,          -- null = pending dispatch
  created_at     timestamptz not null default now()
);

create index if not exists commentary_tags_commentary_idx on public.commentary_tags (commentary_id);
create index if not exists commentary_tags_email_idx      on public.commentary_tags (tagged_email);
create index if not exists commentary_tags_notified_idx   on public.commentary_tags (notified_at) where notified_at is null;

-- ======================================================== notifications ====
-- Persistent in-app notification inbox.  Every event (tag, status change,
-- new comment on something you authored, etc.) creates one row per recipient.
create table if not exists public.notifications (
  id              uuid        primary key default gen_random_uuid(),
  recipient_email text        not null,
  -- 'tag' | 'comment_reply' | 'status_change' | 'email_reply' | 'mention'
  event_type      text        not null,
  title           text        not null check (char_length(title) <= 300),
  body            text        not null default '',
  -- Deep link inside the app.
  link_path       text        not null default '',
  -- Optional reference to the source entity.
  source_type     text,       -- 'commentary' | 'email_thread' | 'workspace' | …
  source_id       uuid,
  read_at         timestamptz,         -- null = unread
  created_at      timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_email, read_at, created_at desc);
create index if not exists notifications_unread_idx    on public.notifications (recipient_email) where read_at is null;
create index if not exists notifications_created_idx   on public.notifications (created_at desc);

-- ------------------------------------------------------------------- RLS ----
alter table public.workspaces         enable row level security;
alter table public.email_threads      enable row level security;
alter table public.commentaries       enable row level security;
alter table public.commentary_tags    enable row level security;
alter table public.notifications      enable row level security;

-- Workspaces: visible to all EG managers.
drop policy if exists workspaces_read on public.workspaces;
create policy workspaces_read on public.workspaces
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- Email threads: visible to all EG managers.
drop policy if exists email_threads_read on public.email_threads;
create policy email_threads_read on public.email_threads
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- Commentaries: visible to all EG managers AND to any externally tagged user
-- whose email appears in commentary_tags (they may not have an EG account).
drop policy if exists commentaries_read on public.commentaries;
create policy commentaries_read on public.commentaries
  for select to authenticated
  using (
    coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org'
    or exists (
      select 1 from public.commentary_tags t
      where t.commentary_id = commentaries.id
        and t.tagged_email = coalesce(auth.jwt() ->> 'email', 'nobody@')
    )
  );

drop policy if exists commentary_tags_read on public.commentary_tags;
create policy commentary_tags_read on public.commentary_tags
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- Notifications: each user sees only their own.
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_email = coalesce(auth.jwt() ->> 'email', 'nobody@'));

-- All writes go through edge functions (service role).

-- ------------------------------------------------------------- realtime ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'commentaries'
  ) then
    alter publication supabase_realtime add table public.commentaries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'email_threads'
  ) then
    alter publication supabase_realtime add table public.email_threads;
  end if;
end $$;
