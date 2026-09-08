create or replace function public.update_plan_with_revision(
  p_plan_id uuid,
  p_patch jsonb
)
returns public.plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_plan public.plans%rowtype;
  updated_plan public.plans%rowtype;
  next_revision_no integer;
begin
  select *
    into current_plan
    from public.plans
    where id = p_plan_id
    for update;

  if not found then
    raise exception 'Plan not found' using errcode = 'P0002';
  end if;

  select coalesce(max(revision_no), 0) + 1
    into next_revision_no
    from public.plan_revisions
    where plan_id = p_plan_id;

  insert into public.plan_revisions (
    plan_id,
    revision_no,
    title,
    start_date,
    end_date,
    priority,
    success_criteria,
    estimated_minutes
  ) values (
    current_plan.id,
    next_revision_no,
    current_plan.title,
    current_plan.start_date,
    current_plan.end_date,
    current_plan.priority,
    current_plan.success_criteria,
    current_plan.estimated_minutes
  );

  update public.plans
    set title = case when p_patch ? 'title' then p_patch ->> 'title' else current_plan.title end,
        start_date = case when p_patch ? 'startDate' then (p_patch ->> 'startDate')::date else current_plan.start_date end,
        end_date = case when p_patch ? 'endDate' then (p_patch ->> 'endDate')::date else current_plan.end_date end,
        priority = case when p_patch ? 'priority' then (p_patch ->> 'priority')::integer else current_plan.priority end,
        success_criteria = case when p_patch ? 'successCriteria' then p_patch ->> 'successCriteria' else current_plan.success_criteria end,
        estimated_minutes = case when p_patch ? 'estimatedMinutes' then (p_patch ->> 'estimatedMinutes')::integer else current_plan.estimated_minutes end,
        archived_at = case when p_patch ? 'archivedAt' then (p_patch ->> 'archivedAt')::timestamptz else current_plan.archived_at end,
        updated_at = now()
    where id = p_plan_id
    returning * into updated_plan;

  return updated_plan;
end;
$$;
