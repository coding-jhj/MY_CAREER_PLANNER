-- T07: authenticated, user-owned workspaces and five-day diary evidence.
-- The legacy public workspace remains claimable by the first signed-in user;
-- it is not visible to anon/authenticated clients while owner_id is NULL.

create schema if not exists private;

alter table public.workspaces
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.workspaces drop constraint if exists workspaces_slug_key;
create unique index if not exists workspaces_owner_slug_key
  on public.workspaces(owner_id, slug);

alter table public.plans drop constraint if exists plans_workspace_id_fkey;
alter table public.plans
  add constraint plans_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces(id) on delete cascade;

alter table public.plan_revisions drop constraint if exists plan_revisions_plan_id_fkey;
alter table public.plan_revisions
  add constraint plan_revisions_plan_id_fkey
  foreign key (plan_id) references public.plans(id) on delete cascade;

alter table public.tasks drop constraint if exists tasks_plan_id_fkey;
alter table public.tasks
  add constraint tasks_plan_id_fkey
  foreign key (plan_id) references public.plans(id) on delete cascade;

alter table public.execution_records drop constraint if exists execution_records_task_id_fkey;
alter table public.execution_records
  add constraint execution_records_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete cascade;

alter table public.reviews drop constraint if exists reviews_plan_id_fkey;
alter table public.reviews
  add constraint reviews_plan_id_fkey
  foreign key (plan_id) references public.plans(id) on delete cascade;

alter table public.reviews drop constraint if exists reviews_next_plan_id_fkey;
alter table public.reviews
  add constraint reviews_next_plan_id_fkey
  foreign key (next_plan_id) references public.plans(id) on delete set null;

create table if not exists public.app_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  record_date date not null,
  question text not null check (length(trim(question)) > 0),
  metric_name text not null check (length(trim(metric_name)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  value numeric not null check (value between -1000000000 and 1000000000),
  calculation_rule text not null check (length(trim(calculation_rule)) > 0),
  plan_rule_version integer not null check (plan_rule_version >= 1),
  plan_rule text not null check (length(trim(plan_rule)) > 0),
  rule_change_reason text,
  entry_origin text not null default 'user_entered'
    check (entry_origin in ('user_entered', 'synthetic_test')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, record_date, metric_name)
);

create index if not exists diary_entries_workspace_date_idx
  on public.diary_entries(workspace_id, record_date);

-- RLS is enabled on every table in the exposed public schema touched by T07.
alter table public.workspaces enable row level security;
alter table public.plans enable row level security;
alter table public.plan_revisions enable row level security;
alter table public.tasks enable row level security;
alter table public.execution_records enable row level security;
alter table public.reviews enable row level security;
alter table public.app_sessions enable row level security;
alter table public.diary_entries enable row level security;

grant select, insert, update, delete on table
  public.workspaces,
  public.plans,
  public.plan_revisions,
  public.tasks,
  public.execution_records,
  public.reviews,
  public.app_sessions,
  public.diary_entries
  to authenticated;

drop policy if exists "workspace owners can select their workspace" on public.workspaces;
create policy "workspace owners can select their workspace"
  on public.workspaces for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "workspace owners can update their workspace" on public.workspaces;
create policy "workspace owners can update their workspace"
  on public.workspaces for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "owners can select plans" on public.plans;
create policy "owners can select plans" on public.plans for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = plans.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert plans" on public.plans;
create policy "owners can insert plans" on public.plans for insert to authenticated
  with check (exists (select 1 from public.workspaces w where w.id = plans.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update plans" on public.plans;
create policy "owners can update plans" on public.plans for update to authenticated
  using (exists (select 1 from public.workspaces w where w.id = plans.workspace_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.workspaces w where w.id = plans.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete plans" on public.plans;
create policy "owners can delete plans" on public.plans for delete to authenticated
  using (exists (select 1 from public.workspaces w where w.id = plans.workspace_id and w.owner_id = (select auth.uid())));

drop policy if exists "owners can select plan revisions" on public.plan_revisions;
create policy "owners can select plan revisions" on public.plan_revisions for select to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = plan_revisions.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert plan revisions" on public.plan_revisions;
create policy "owners can insert plan revisions" on public.plan_revisions for insert to authenticated
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = plan_revisions.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update plan revisions" on public.plan_revisions;
create policy "owners can update plan revisions" on public.plan_revisions for update to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = plan_revisions.plan_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = plan_revisions.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete plan revisions" on public.plan_revisions;
create policy "owners can delete plan revisions" on public.plan_revisions for delete to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = plan_revisions.plan_id and w.owner_id = (select auth.uid())));

drop policy if exists "owners can select tasks" on public.tasks;
create policy "owners can select tasks" on public.tasks for select to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = tasks.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert tasks" on public.tasks;
create policy "owners can insert tasks" on public.tasks for insert to authenticated
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = tasks.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update tasks" on public.tasks;
create policy "owners can update tasks" on public.tasks for update to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = tasks.plan_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = tasks.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete tasks" on public.tasks;
create policy "owners can delete tasks" on public.tasks for delete to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = tasks.plan_id and w.owner_id = (select auth.uid())));

drop policy if exists "owners can select execution records" on public.execution_records;
create policy "owners can select execution records" on public.execution_records for select to authenticated
  using (exists (select 1 from public.tasks t join public.plans p on p.id = t.plan_id join public.workspaces w on w.id = p.workspace_id where t.id = execution_records.task_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert execution records" on public.execution_records;
create policy "owners can insert execution records" on public.execution_records for insert to authenticated
  with check (exists (select 1 from public.tasks t join public.plans p on p.id = t.plan_id join public.workspaces w on w.id = p.workspace_id where t.id = execution_records.task_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update execution records" on public.execution_records;
create policy "owners can update execution records" on public.execution_records for update to authenticated
  using (exists (select 1 from public.tasks t join public.plans p on p.id = t.plan_id join public.workspaces w on w.id = p.workspace_id where t.id = execution_records.task_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.tasks t join public.plans p on p.id = t.plan_id join public.workspaces w on w.id = p.workspace_id where t.id = execution_records.task_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete execution records" on public.execution_records;
create policy "owners can delete execution records" on public.execution_records for delete to authenticated
  using (exists (select 1 from public.tasks t join public.plans p on p.id = t.plan_id join public.workspaces w on w.id = p.workspace_id where t.id = execution_records.task_id and w.owner_id = (select auth.uid())));

drop policy if exists "owners can select reviews" on public.reviews;
create policy "owners can select reviews" on public.reviews for select to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = reviews.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert reviews" on public.reviews;
create policy "owners can insert reviews" on public.reviews for insert to authenticated
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = reviews.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update reviews" on public.reviews;
create policy "owners can update reviews" on public.reviews for update to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = reviews.plan_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = reviews.plan_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete reviews" on public.reviews;
create policy "owners can delete reviews" on public.reviews for delete to authenticated
  using (exists (select 1 from public.plans p join public.workspaces w on w.id = p.workspace_id where p.id = reviews.plan_id and w.owner_id = (select auth.uid())));

drop policy if exists "users can select their sessions" on public.app_sessions;
create policy "users can select their sessions" on public.app_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "users can insert their sessions" on public.app_sessions;
create policy "users can insert their sessions" on public.app_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "users can update their sessions" on public.app_sessions;
create policy "users can update their sessions" on public.app_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "owners can select diary entries" on public.diary_entries;
create policy "owners can select diary entries" on public.diary_entries for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = diary_entries.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can insert diary entries" on public.diary_entries;
create policy "owners can insert diary entries" on public.diary_entries for insert to authenticated
  with check (exists (select 1 from public.workspaces w where w.id = diary_entries.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can update diary entries" on public.diary_entries;
create policy "owners can update diary entries" on public.diary_entries for update to authenticated
  using (exists (select 1 from public.workspaces w where w.id = diary_entries.workspace_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.workspaces w where w.id = diary_entries.workspace_id and w.owner_id = (select auth.uid())));
drop policy if exists "owners can delete diary entries" on public.diary_entries;
create policy "owners can delete diary entries" on public.diary_entries for delete to authenticated
  using (exists (select 1 from public.workspaces w where w.id = diary_entries.workspace_id and w.owner_id = (select auth.uid())));

-- A trigger claims the legacy T06 workspace for the first account. Later
-- accounts receive a new private workspace with the same display slug.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_workspace_id uuid;
begin
  update public.workspaces
  set owner_id = new.id
  where slug = 'public' and owner_id is null
  returning id into claimed_workspace_id;

  if claimed_workspace_id is not null then
    return new;
  end if;

  insert into public.workspaces(owner_id, slug, title, timezone)
  values (new.id, 'public', '나의 커리어 플래너', 'Asia/Seoul');
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
grant execute on function private.handle_new_user() to postgres, supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Existing transaction functions must remain invoker-scoped and callable only
-- by signed-in users now that their tables are protected by RLS.
revoke execute on function public.update_plan_with_revision(uuid, jsonb) from public, anon;
grant execute on function public.update_plan_with_revision(uuid, jsonb) to authenticated;
revoke execute on function public.complete_task_with_execution(uuid, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.complete_task_with_execution(uuid, timestamptz, timestamptz, text, uuid) to authenticated;
revoke execute on function public.record_execution_for_active_task(uuid, timestamptz, timestamptz, text, uuid) from public, anon;
grant execute on function public.record_execution_for_active_task(uuid, timestamptz, timestamptz, text, uuid) to authenticated;
revoke execute on function public.create_review_with_next_plan(uuid, text, uuid, text, date, date, integer, text, integer) from public, anon;
grant execute on function public.create_review_with_next_plan(uuid, text, uuid, text, date, date, integer, text, integer) to authenticated;
