import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Plan } from "../../lib/domain/types";
import { ValidationError } from "../../lib/server/errors";
import type { PlanRepository } from "../../lib/server/repositories/contracts";
import {
  createPlan,
  updatePlan,
} from "../../lib/server/services/plan-service";

const validInput = {
  workspaceId: "workspace-1",
  title: "Post-training preparation",
  startDate: "2026-09-07",
  endDate: "2026-10-07",
  priority: 1,
  successCriteria: "Record learning and experiments.",
  estimatedMinutes: 120,
};

const originalPlan: Plan = {
  id: "plan-1",
  ...validInput,
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
  archivedAt: null,
};

function createRepository(): PlanRepository {
  return {
    getCurrent: vi.fn(), listByWorkspace: vi.fn(), getById: vi.fn(),
    insert: vi.fn().mockResolvedValue(originalPlan),
    updateWithRevision: vi.fn().mockResolvedValue({
      ...originalPlan,
      title: "Revised preparation",
      updatedAt: "2026-09-08T00:00:00.000Z",
    }),
    listRevisions: vi.fn().mockResolvedValue([]),
  };
}

describe("plan service", () => {
  it("stores all required plan fields", async () => {
    const repository = createRepository();

    const plan = await createPlan(repository, validInput);

    expect(plan.priority).toBe(1);
    expect(plan.estimatedMinutes).toBe(120);
    expect(repository.insert).toHaveBeenCalledWith("workspace-1", validInput);
  });

  it("uses the revision transaction before changing the current plan", async () => {
    const repository = createRepository();
    const changes = { title: "Revised preparation" };

    const plan = await updatePlan(repository, "plan-1", changes);

    expect(plan.id).toBe("plan-1");
    expect(repository.updateWithRevision).toHaveBeenCalledWith("plan-1", changes);
  });

  it("preserves field-specific validation errors", async () => {
    const repository = createRepository();

    await expect(
      createPlan(repository, {
        ...validInput,
        title: " ",
        endDate: "2026-09-06",
        priority: 6,
        estimatedMinutes: -1,
      }),
    ).rejects.toMatchObject({
      name: ValidationError.name,
      details: expect.objectContaining({
        title: expect.any(Array),
        endDate: expect.any(Array),
        priority: expect.any(Array),
        estimatedMinutes: expect.any(Array),
      }),
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });
});

describe("plan revision migration", () => {
  it("locks, snapshots, and updates a plan inside one RPC function", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/002_plan_revision_transaction.sql"),
      "utf8",
    );

    expect(migration).toContain("function public.update_plan_with_revision");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.plan_revisions");
    expect(migration).toContain("update public.plans");
  });
});
