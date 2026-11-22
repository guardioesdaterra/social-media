-- ============================================================================
-- Provider tokens · Store Google OAuth provider_token for Gmail API calls
-- Only EG managers have rows; they are overwritten on each sign-in.
-- ============================================================================

create table if not exists public.manager_provider_tokens (
  user_id          uuid        primary key
                     references auth.users (id) on delete cascade,
  email            text        not null unique,
  -- Short-lived Google access token (1 hour). Stored encrypted at rest by
  -- Postgres (AES-256 via Supabase Vault is optional — here we store as text
  -- and rely on RLS + service-role-only writes to protect it).
  provider_token          text,
  provider_refresh_token  text,
  token_expires_at        timestamptz,
  updated_at              timestamptz not null default now()
);

-- RLS: users can read only their own row; writes go via edge function (service role).
alter table public.manager_provider_tokens enable row level security;

drop policy if exists provider_tokens_own on public.manager_provider_tokens;
create policy provider_tokens_own on public.manager_provider_tokens
  for select to authenticated
  using (user_id = auth.uid());
