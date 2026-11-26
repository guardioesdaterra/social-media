-- 0002_add_video_columns_to_calendar_posts.sql
-- Adds base64 video storage columns to calendar_posts, mirroring the existing
-- image_* columns. Media (image or video) is stored as a data URL in Postgres,
-- not in S3.
--
-- NOTE: the Supabase schema/edge functions for this project live outside this
-- repo. Apply this migration manually (Supabase Dashboard → SQL Editor, or
-- `psql` against the linked project) and update the `calendar-save` edge
-- function to upsert the new columns (see implementation notes).
ALTER TABLE public.calendar_posts
  ADD COLUMN IF NOT EXISTS video_base64 text,
  ADD COLUMN IF NOT EXISTS video_mime text,
  ADD COLUMN IF NOT EXISTS video_name text,
  ADD COLUMN IF NOT EXISTS video_bytes bigint;
