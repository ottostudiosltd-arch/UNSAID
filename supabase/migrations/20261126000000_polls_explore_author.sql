-- Add college code/short_name, author_name, and Poll support + atomic poll voting

alter table public.colleges
  add column if not exists code text,
  add column if not exists short_name text;

create unique index if not exists uq_colleges_code on public.colleges (code) where code is not null;

alter table public.confessions
  add column if not exists college_code text not null default '',
  add column if not exists college_name text not null default '',
  add column if not exists author_name text not null default 'Anonymous'
    check (char_length(trim(author_name)) between 1 and 28),
  add column if not exists poll jsonb;

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  confession_id uuid not null references public.confessions(id) on delete cascade,
  session_hash text not null,
  option_id text not null,
  created_at timestamptz not null default now(),
  constraint uq_poll_vote_session unique (confession_id, session_hash)
);

alter table public.poll_votes enable row level security;
revoke all on table public.poll_votes from anon, authenticated;

-- Atomic poll vote / vote-switch RPC
create or replace function public.vote_poll_atomic(
  p_confession_id uuid,
  p_option_id text,
  p_session_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conf public.confessions%rowtype;
  v_prev_option text;
  v_options jsonb;
  v_new_options jsonb := '[]'::jsonb;
  v_opt jsonb;
  v_found_option boolean := false;
  v_votes integer;
begin
  select *
  into v_conf
  from public.confessions
  where id = p_confession_id
    and status = 'approved'
  for update;

  if not found or v_conf.poll is null then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Poll not found.');
  end if;

  v_options := v_conf.poll->'options';
  if v_options is null or jsonb_typeof(v_options) <> 'array' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_POLL', 'message', 'Invalid poll structure.');
  end if;

  select option_id into v_prev_option
  from public.poll_votes
  where confession_id = p_confession_id
    and session_hash = p_session_hash;

  for v_opt in select * from jsonb_array_elements(v_options)
  loop
    v_votes := coalesce((v_opt->>'votes')::integer, 0);
    if v_prev_option is not null and (v_opt->>'id') = v_prev_option then
      v_votes := greatest(0, v_votes - 1);
    end if;
    if (v_opt->>'id') = p_option_id then
      v_found_option := true;
      v_votes := v_votes + 1;
    end if;
    v_new_options := v_new_options || jsonb_build_object(
      'id', v_opt->>'id',
      'label', v_opt->>'label',
      'votes', v_votes
    );
  end loop;

  if not v_found_option then
    return jsonb_build_object('ok', false, 'code', 'INVALID_OPTION', 'message', 'Poll option not found.');
  end if;

  insert into public.poll_votes (confession_id, session_hash, option_id)
  values (p_confession_id, p_session_hash, p_option_id)
  on conflict (confession_id, session_hash)
  do update set option_id = excluded.option_id;

  update public.confessions
  set poll = jsonb_set(v_conf.poll, '{options}', v_new_options)
  where id = p_confession_id
  returning * into v_conf;

  return jsonb_build_object(
    'ok', true,
    'confession', jsonb_build_object(
      'id', v_conf.id,
      'college_code', v_conf.college_code,
      'college_name', v_conf.college_name,
      'author_name', v_conf.author_name,
      'category', v_conf.category,
      'vibe', v_conf.vibe,
      'content', v_conf.content,
      'poll', v_conf.poll,
      'likes_count', v_conf.likes_count,
      'comments_count', v_conf.comments_count,
      'created_at', v_conf.created_at
    )
  );
end;
$$;

revoke all on function public.vote_poll_atomic(uuid, text, text) from public, anon, authenticated;
grant execute on function public.vote_poll_atomic(uuid, text, text) to service_role;

-- Allow approved confessions (own campus or Explore) to receive comments up to 100, preserving parent college_id
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
  for update;

  if not found or (v_confession.status <> 'approved' and v_confession.college_id <> p_college_id) then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Confession not found.');
  end if;

  if v_confession.status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'NOT_ACTIVE', 'message', 'Comments are closed for this confession.');
  end if;

  if v_confession.comments_count >= 100 then
    return jsonb_build_object('ok', false, 'code', 'COMMENT_LIMIT_REACHED', 'message', 'Maximum 100 comments reached for this confession.');
  end if;

  insert into public.comments (confession_id, college_id, content, status, session_hash)
  values (p_confession_id, v_confession.college_id, p_content, 'approved', p_session_hash)
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

-- Allow approved confessions (own campus or Explore) to receive session-deduped likes
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
    values (p_confession_id, v_confession.college_id, p_session_hash);
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
