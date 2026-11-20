-- ============================================================================
-- Social Media · Earth Guardians editorial calendar
-- Topics (linked by every post), multi-post days, attention ranking,
-- realtime, RLS.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- topics ----
create table if not exists public.calendar_topics (
  key              text primary key check (key ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  label            text        not null,
  description      text        not null default '',
  color            text        not null default '#22C55E' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  emoji            text        not null default '•',
  sort             integer     not null default 0,
  needs_attention  boolean     not null default false,
  -- 1 = highest priority. NULL when needs_attention = false.
  attention_rank   integer     check (attention_rank is null or attention_rank > 0),
  updated_at       timestamptz not null default now(),
  updated_by       text,

  constraint attention_requires_rank
    check ((needs_attention and attention_rank is not null)
        or (not needs_attention and attention_rank is null))
);

create index if not exists calendar_topics_attention_idx
  on public.calendar_topics (attention_rank asc)
  where needs_attention;

-- ----------------------------------------------------------------- posts ----
create table if not exists public.calendar_posts (
  id              uuid primary key default gen_random_uuid(),
  -- The real date. Multiple posts may share the same day.
  day             date        not null
                    check (day between date '2020-01-01' and date '2100-12-31'),
  -- Derived from `day` so month/year queries never drift.
  year            integer     generated always as (extract(year from day)::integer) stored,
  month           integer     generated always as (extract(month from day)::integer) stored,
  dow             text        generated always as (
                    case extract(dow from day)::integer
                      when 0 then 'Sun' when 1 then 'Mon' when 2 then 'Tue'
                      when 3 then 'Wed' when 4 then 'Thu' when 5 then 'Fri'
                      else 'Sat'
                    end
                  ) stored,

  -- REQUIRED: every post is linked to exactly one topic.
  topic_key       text        not null
                    references public.calendar_topics (key) on update cascade on delete restrict,

  format          text        not null default 'Carousel'
                    check (format in ('Carousel','Photo','Reel','Story','Video')),
  title           text        not null default '' check (char_length(title) <= 300),
  caption         text        not null default '' check (char_length(caption) <= 10000),
  hashtags        text        not null default '' check (char_length(hashtags) <= 2000),
  status          text        not null default 'planned'
                    check (status in ('planned','production','approved','published')),

  -- Base64 payload kept in Postgres (not S3), capped at 4 MiB.
  image_base64    text,
  image_mime      text        check (image_mime is null or image_mime ~ '^image/'),
  image_name      text,
  image_bytes     integer     check (image_bytes is null or image_bytes >= 0),

  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      text,

  constraint image_has_size check (
    (image_base64 is null and image_bytes is null)
    or (image_base64 is not null and image_bytes is not null)
  ),
  constraint image_size_cap check (image_bytes is null or image_bytes <= 4194304)
);

create index if not exists calendar_posts_day_idx      on public.calendar_posts (day, sort_order);
create index if not exists calendar_posts_month_idx   on public.calendar_posts (year, month);
create index if not exists calendar_posts_topic_idx   on public.calendar_posts (topic_key);
create index if not exists calendar_posts_status_idx  on public.calendar_posts (status);

-- -------------------------------------------------------------- settings ----
create table if not exists public.calendar_settings (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Version counter bumped on every write; clients reconcile realtime echoes.
insert into public.calendar_settings (key, value)
values ('version', to_jsonb(0::bigint))
on conflict (key) do nothing;

-- ------------------------------------------------------------------- RLS ----
alter table public.calendar_topics  enable row level security;
alter table public.calendar_posts   enable row level security;
alter table public.calendar_settings enable row level security;

-- Reads: signed-in Earth Guardians managers only.
drop policy if exists calendar_topics_read on public.calendar_topics;
create policy calendar_topics_read on public.calendar_topics
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

drop policy if exists calendar_posts_read on public.calendar_posts;
create policy calendar_posts_read on public.calendar_posts
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

drop policy if exists calendar_settings_read on public.calendar_settings;
create policy calendar_settings_read on public.calendar_settings
  for select to authenticated
  using (coalesce(auth.jwt() ->> 'email', '') like '%@earthguardians.org');

-- No INSERT/UPDATE/DELETE policies on purpose: every write goes through the
-- `calendar-save` edge function (service role) after the manager gate.

-- --------------------------------------------------------------- realtime ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_posts'
  ) then
    alter publication supabase_realtime add table public.calendar_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_topics'
  ) then
    alter publication supabase_realtime add table public.calendar_topics;
  end if;
end $$;
