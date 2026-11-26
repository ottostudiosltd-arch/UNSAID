-- UNSAID. Initial Database Schema, Constraints, Indexes, RLS, and Atomic RPCs
-- Strictly enforces:
-- 1. Zero direct public database writes (RLS enabled + privileges revoked from anon/authenticated)
-- 2. College isolation via composite foreign keys & mandatory college_id
-- 3. 1,000 char confession limit, 500 char comment limit, 100 comments/confession atomic limit
-- 4. 90-day retention & DB size monitoring helpers

create extension if not exists pgcrypto;

-- 1. Colleges
create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  code_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2. Confessions
create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  category text not null default 'thoughts'
    check (category in ('love', 'funny', 'college', 'secrets', 'thoughts')),
  vibe text not null default 'other'
    check (vibe in ('happy', 'stressed', 'excited', 'other')),
  content text not null
    check (char_length(trim(content)) >= 5 and char_length(content) <= 1000),
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected', 'hidden')),
  likes_count integer not null default 0 check (likes_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0 and comments_count <= 100),
  session_hash text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  constraint uq_confessions_id_college unique (id, college_id)
);

-- 3. Comments (college_id enforced to match parent confession via composite FK)
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null,
  college_id uuid not null,
  content text not null
    check (char_length(trim(content)) >= 1 and char_length(content) <= 500),
  status text not null default 'approved'
    check (status in ('approved', 'hidden', 'rejected')),
  session_hash text not null,
  created_at timestamptz not null default now(),
  constraint fk_comments_confession_college
    foreign key (confession_id, college_id)
    references public.confessions(id, college_id)
    on delete cascade
);

-- 4. Likes (session-deduped per confession, college matched via composite FK)
create table if not exists public.confession_likes (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null,
  college_id uuid not null,
  session_hash text not null,
  created_at timestamptz not null default now(),
  constraint fk_likes_confession_college
    foreign key (confession_id, college_id)
    references public.confessions(id, college_id)
    on delete cascade,
  constraint uq_confession_like_session unique (confession_id, session_hash)
);

-- 5. Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  target_type text not null check (target_type in ('confession', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'hate_speech', 'doxxing', 'self_harm', 'other')),
  details text check (details is null or char_length(details) <= 300),
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  preserve_for_safety boolean not null default false,
  session_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

-- 6. Admin Users (linked to Supabase Auth users)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check (role in ('moderator', 'super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 7. Moderation Logs
create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'approve_confession',
    'reject_confession',
    'hide_confession',
    'hide_comment',
    'resolve_report',
    'dismiss_report',
    'toggle_submissions',
    'run_cleanup'
  )),
  target_type text not null,
  target_id uuid,
  college_id uuid,
  note text check (note is null or char_length(note) <= 250),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

-- 8. Rate Limits (atomic fixed-window counters)
create table if not exists public.rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  expires_at timestamptz not null,
  primary key (bucket_key, window_start)
);

-- 9. System Controls (capacity protection switch)
create table if not exists public.system_controls (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.system_controls (key, value)
values
  ('submissions_enabled', '{"enabled": true, "reason": null}'::jsonb),
  ('storage_thresholds_mb', '{"monitor": 300, "action": 350, "protect": 400, "hard_pause": 450}'::jsonb)
on conflict (key) do nothing;

-- Indexes (targeted to avoid unnecessary write/storage overhead)
create index if not exists idx_confessions_feed
  on public.confessions (college_id, status, created_at desc);

create index if not exists idx_confessions_category
  on public.confessions (college_id, status, category, created_at desc);

create index if not exists idx_confessions_trending
  on public.confessions (college_id, status, likes_count desc, comments_count desc, created_at desc);

create index if not exists idx_confessions_duplicate_check
  on public.confessions (college_id, session_hash, content_hash, created_at desc);

create index if not exists idx_comments_confession
  on public.comments (confession_id, status, created_at asc);

create index if not exists idx_reports_status
  on public.reports (status, created_at desc);

create index if not exists idx_rate_limits_expires
  on public.rate_limits (expires_at);

-- Enable Row Level Security on every exposed table (Default Deny)
alter table public.colleges enable row level security;
alter table public.confessions enable row level security;
alter table public.comments enable row level security;
alter table public.confession_likes enable row level security;
alter table public.reports enable row level security;
alter table public.admin_users enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.system_controls enable row level security;

-- Defense-in-depth: revoke direct PostgREST table access from anon & authenticated.
-- All client operations go through Edge Functions with strict validation & token verification.
revoke all on table public.colleges from anon, authenticated;
revoke all on table public.confessions from anon, authenticated;
revoke all on table public.comments from anon, authenticated;
revoke all on table public.confession_likes from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.moderation_logs from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;
revoke all on table public.system_controls from anon, authenticated;

-- Atomic rate-limiter RPC (fixed window)
create or replace function public.check_and_increment_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_epoch bigint := floor(extract(epoch from v_now))::bigint;
  v_window_epoch bigint := (v_epoch / p_window_seconds) * p_window_seconds;
  v_window_start timestamptz := to_timestamp(v_window_epoch);
  v_expires_at timestamptz := to_timestamp(v_window_epoch + p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (bucket_key, window_start, request_count, expires_at)
  values (p_bucket_key, v_window_start, 1, v_expires_at)
  on conflict (bucket_key, window_start)
  do update set request_count = public.rate_limits.request_count + 1
  returning request_count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'remaining', greatest(0, p_limit - v_count),
    'reset_at', v_expires_at
  );
end;
$$;

-- Atomic comment insertion enforcing 100-comment limit + college match + approved parent
create or replace function public.create_comment_atomic(
  p_confession_id uuid,
  p_college_id uuid,
  p_content text,
  p_session_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confession public.confessions%rowtype;
  v_comment public.comments%rowtype;
begin
  select *
  into v_confession
  from public.confessions
  where id = p_confession_id
    and college_id = p_college_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Confession not found for this campus.');
  end if;

  if v_confession.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'NOT_ACTIVE', 'message', 'Comments are closed for this confession.');
  end if;

  if v_confession.comments_count >= 100 then
    return jsonb_build_object('ok', false, 'code', 'COMMENT_LIMIT_REACHED', 'message', 'Maximum 100 comments reached for this confession.');
  end if;

  insert into public.comments (confession_id, college_id, content, status, session_hash)
  values (p_confession_id, p_college_id, p_content, 'approved', p_session_hash)
  returning * into v_comment;

  update public.confessions
  set comments_count = comments_count + 1
  where id = p_confession_id;

  return jsonb_build_object(
    'ok', true,
    'comment', jsonb_build_object(
      'id', v_comment.id,
      'confession_id', v_comment.confession_id,
      'content', v_comment.content,
      'created_at', v_comment.created_at
    ),
    'comments_count', v_confession.comments_count + 1
  );
end;
$$;

-- Atomic like toggle per anonymous session
create or replace function public.toggle_confession_like(
  p_confession_id uuid,
  p_college_id uuid,
  p_session_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confession public.confessions%rowtype;
  v_existing_id uuid;
  v_new_count integer;
  v_liked boolean;
begin
  select *
  into v_confession
  from public.confessions
  where id = p_confession_id
    and college_id = p_college_id
    and status = 'approved'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select id into v_existing_id
  from public.confession_likes
  where confession_id = p_confession_id
    and session_hash = p_session_hash;

  if found then
    delete from public.confession_likes where id = v_existing_id;
    update public.confessions
    set likes_count = greatest(0, likes_count - 1)
    where id = p_confession_id
    returning likes_count into v_new_count;
    v_liked := false;
  else
    insert into public.confession_likes (confession_id, college_id, session_hash)
    values (p_confession_id, p_college_id, p_session_hash);
    update public.confessions
    set likes_count = likes_count + 1
    where id = p_confession_id
    returning likes_count into v_new_count;
    v_liked := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'liked', v_liked,
    'likes_count', v_new_count
  );
end;
$$;

-- Database storage & usage health helper (300/350/400/450 MB guardrails)
create or replace function public.get_database_health()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_db_bytes bigint := pg_database_size(current_database());
  v_db_mb numeric := round((v_db_bytes::numeric / (1024 * 1024)), 2);
  v_tier text := 'normal';
  v_submissions jsonb;
begin
  if v_db_mb >= 450 then
    v_tier := 'hard_pause';
  elsif v_db_mb >= 400 then
    v_tier := 'protect_capacity';
  elsif v_db_mb >= 350 then
    v_tier := 'take_action';
  elsif v_db_mb >= 300 then
    v_tier := 'monitor';
  end if;

  select value into v_submissions
  from public.system_controls
  where key = 'submissions_enabled';

  return jsonb_build_object(
    'db_bytes', v_db_bytes,
    'db_mb', v_db_mb,
    'tier', v_tier,
    'submissions_enabled', coalesce((v_submissions->>'enabled')::boolean, true),
    'confessions_count', (select count(*) from public.confessions),
    'comments_count', (select count(*) from public.comments),
    'open_reports_count', (select count(*) from public.reports where status = 'open')
  );
end;
$$;

-- 90-day retention cleanup RPC (run via scheduled cron or admin action)
create or replace function public.cleanup_expired_records()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_confessions integer := 0;
  v_deleted_reports integer := 0;
  v_deleted_logs integer := 0;
  v_deleted_rate_limits integer := 0;
begin
  delete from public.confessions where expires_at < now();
  get diagnostics v_deleted_confessions = row_count;

  delete from public.reports where expires_at < now() and preserve_for_safety = false;
  get diagnostics v_deleted_reports = row_count;

  delete from public.moderation_logs where expires_at < now();
  get diagnostics v_deleted_logs = row_count;

  delete from public.rate_limits where expires_at < now();
  get diagnostics v_deleted_rate_limits = row_count;

  return jsonb_build_object(
    'deleted_confessions', v_deleted_confessions,
    'deleted_reports', v_deleted_reports,
    'deleted_logs', v_deleted_logs,
    'deleted_rate_limits', v_deleted_rate_limits,
    'ran_at', now()
  );
end;
$$;

-- Restrict RPC execution strictly to service_role
revoke all on function public.check_and_increment_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_comment_atomic(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.toggle_confession_like(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.get_database_health() from public, anon, authenticated;
revoke all on function public.cleanup_expired_records() from public, anon, authenticated;

grant execute on function public.check_and_increment_rate_limit(text, integer, integer) to service_role;
grant execute on function public.create_comment_atomic(uuid, uuid, text, text) to service_role;
grant execute on function public.toggle_confession_like(uuid, uuid, text) to service_role;
grant execute on function public.get_database_health() to service_role;
grant execute on function public.cleanup_expired_records() to service_role;
