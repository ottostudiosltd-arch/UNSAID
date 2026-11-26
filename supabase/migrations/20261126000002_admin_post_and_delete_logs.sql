-- Allow admin_create_confession and delete_confession actions in moderation_logs

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
    'resolve_report',
    'dismiss_report',
    'toggle_submissions',
    'run_cleanup'
  ));
