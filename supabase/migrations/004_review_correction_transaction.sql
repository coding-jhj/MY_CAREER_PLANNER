create or replace function public.create_review_with_next_plan(
  p_plan_id uuid,
  p_correction_text text,
  p_workspace_id uuid,
  p_title text,
  p_start_date date,
  p_end_date date,
  p_priority integer,
  p_success_criteria text,
  p_estimated_minutes integer
)
returns jsonb
language plpgsql
as $$
declare
  source_plan public.plans%rowtype;
  next_plan public.plans%rowtype;
  saved_review public.reviews%rowtype;
begin
  select * into source_plan
  from public.plans
  where id = p_plan_id
  for update;

  if not found then
    raise exception 'source_plan_not_found' using errcode = 'P0002';
  end if;

  if nullif(trim(p_correction_text), '') is null then
    raise exception 'invalid_correction_text' using errcode = '23514';
  end if;

  insert into public.plans (
    workspace_id, title, start_date, end_date, priority, success_criteria, estimated_minutes
  ) values (
    p_workspace_id, p_title, p_start_date, p_end_date, p_priority, p_success_criteria, p_estimated_minutes
  ) returning * into next_plan;

  insert into public.reviews (plan_id, correction_text, next_plan_id)
  values (source_plan.id, trim(p_correction_text), next_plan.id)
  returning * into saved_review;

  return jsonb_build_object(
    'review', to_jsonb(saved_review),
    'nextPlan', to_jsonb(next_plan)
  );
end;
$$;
