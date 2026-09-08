import {
  parseCreatePlanInput,
  parseUpdatePlanInput,
  requireNonEmptyId,
} from "../../domain/validation";
import type { CreatePlanInput, Plan, PlanRevision, UpdatePlanInput } from "../../domain/types";
import type { PlanRepository } from "../repositories/contracts";

export async function createPlan(
  repository: PlanRepository,
  input: unknown,
): Promise<Plan> {
  const planInput: CreatePlanInput = parseCreatePlanInput(input);
  return repository.insert(planInput.workspaceId, planInput);
}

export async function updatePlan(
  repository: PlanRepository,
  planId: string,
  input: unknown,
): Promise<Plan> {
  const id = requireNonEmptyId(planId, "planId");
  const planInput: UpdatePlanInput = parseUpdatePlanInput(input);
  return repository.updateWithRevision(id, planInput);
}

export async function getPlan(
  repository: PlanRepository,
  workspaceId: string,
): Promise<Plan | null> {
  return repository.getCurrent(requireNonEmptyId(workspaceId, "workspaceId"));
}

export async function listPlanRevisions(
  repository: PlanRepository,
  planId: string,
): Promise<PlanRevision[]> {
  return repository.listRevisions(requireNonEmptyId(planId, "planId"));
}
