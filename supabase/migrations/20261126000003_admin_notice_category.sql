-- Allow 'notice' category for official Admin Notices

alter table public.confessions
  drop constraint if exists confessions_category_check;

alter table public.confessions
  add constraint confessions_category_check
  check (category in ('love', 'funny', 'college', 'secrets', 'thoughts', 'notice'));
