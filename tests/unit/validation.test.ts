import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/001_initial_schema.sql"),
  "utf8",
);

describe("database validation contract", () => {
  it("limits plan and task priorities to 1 through 5", () => {
    expect(migration.match(/check \(priority between 1 and 5\)/g)).toHaveLength(3);
  });

  it("rejects negative estimated and actual times", () => {
    expect(migration).toContain("check (estimated_minutes >= 0)");
    expect(migration).toContain("check (actual_minutes >= 0)");
  });

  it("requires plan and execution dates to be ordered", () => {
    expect(migration).toContain("check (end_date >= start_date)");
    expect(migration).toContain("check (ended_at >= started_at)");
  });

  it("limits task status values to the three domain values", () => {
    expect(migration).toContain(
      "check (status in ('todo', 'in_progress', 'done'))",
    );
  });
});
