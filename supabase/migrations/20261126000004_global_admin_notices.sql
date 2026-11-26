-- Support single-row Global Admin Notices visible across all campus feeds without duplicating rows

alter table public.confessions
  add column if not exists is_global boolean not null default false;

create index if not exists idx_confessions_global
  on public.confessions (is_global, status, created_at desc)
  where is_global = true;

-- Merge any previously duplicated broadcast notices into a single global row
with ranked as (
  select
    id,
    row_number() over (partition by content_hash, author_name order by created_at asc) as rn,
    count(*) over (partition by content_hash, author_name) as cnt
  from public.confessions
  where category = 'notice'
)
update public.confessions c
set
  is_global = true,
  college_code = 'ALL',
  college_name = 'All Campuses'
from ranked r
where c.id = r.id
  and r.rn = 1
  and r.cnt > 1;

with ranked as (
  select
    id,
    row_number() over (partition by content_hash, author_name order by created_at asc) as rn,
    count(*) over (partition by content_hash, author_name) as cnt
  from public.confessions
  where category = 'notice'
)
delete from public.confessions c
using ranked r
where c.id = r.id
  and r.rn > 1
  and r.cnt > 1;
