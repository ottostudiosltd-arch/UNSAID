-- Own post/comment deletion, Admin comment deletion, and global Admin Notice comment support

alter table public.moderation_logs
  drop constraint if exists moderation_logs_action_check;

alter table public.moderation_logs
  add constraint moderation_logs_action_check
  check (action in (
    'approve_confession',
    'reject_confession',
    'hide_confession',
    'delete_confession',
    'admin_create_confession',
    'hide_comment',
    'delete_comment',
    'resolve_report',
    'dismiss_report',
    'toggle_submissions',
    'run_cleanup'
  ));

-- Allow commenting on Global Admin Notices as well as same-campus confessions
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
    and (college_id = p_college_id or is_global = true)
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

-- Atomic comment deletion enforcing either author session_hash ownership or admin override
create or replace function public.delete_comment_atomic(
  p_comment_id uuid,
  p_session_hash text,
  p_is_admin boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.comments%rowtype;
  v_new_count integer := 0;
begin
  select *
  into v_comment
  from public.comments
  where id = p_comment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Comment not found.');
  end if;

  if not p_is_admin and v_comment.session_hash <> p_session_hash then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN', 'message', 'You can only delete your own comment.');
  end if;

  -- Lock parent confession row before decrementing count
  select comments_count
  into v_new_count
  from public.confessions
  where id = v_comment.confession_id
  for update;

  delete from public.comments
  where id = p_comment_id;

  if found and v_comment.status = 'approved' then
    update public.confessions
    set comments_count = greatest(0, comments_count - 1)
    where id = v_comment.confession_id
    returning comments_count into v_new_count;
  end if;

  update public.reports
  set status = 'resolved'
  where target_type = 'comment'
    and target_id = p_comment_id
    and status in ('open', 'reviewed');

  return jsonb_build_object(
    'ok', true,
    'confession_id', v_comment.confession_id,
    'college_id', v_comment.college_id,
    'comments_count', coalesce(v_new_count, 0)
  );
end;
$$;

revoke all on function public.create_comment_atomic(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_comment_atomic(uuid, uuid, text, text) to service_role;

revoke all on function public.delete_comment_atomic(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.delete_comment_atomic(uuid, text, boolean) to service_role;
