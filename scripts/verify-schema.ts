import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredTables = ["workspaces", "plans", "plan_revisions", "tasks", "execution_records", "reviews"] as const;
const requiredRelations = ["workspaces 1:N plans", "plans 1:N plan_revisions", "plans 1:N tasks", "tasks 1:N execution_records", "plans 1:N reviews", "reviews 0:1 plans(next_plan_id)"] as const;
const requiredIndexes = ["plans.workspace_id", "plan_revisions.plan_id", "tasks.plan_id", "tasks.due_date", "tasks.status", "tasks.tag", "execution_records.task_id", "reviews.plan_id"] as const;
const requiredFields: Record<string, Record<string, Record<string, unknown>>> = {
  workspaces: { id: { type: "uuid", nullable: false, primaryKey: true }, slug: { type: "text", nullable: false, unique: true }, title: { type: "text", nullable: false }, timezone: { type: "text", nullable: false, default: "Asia/Seoul" }, created_at: { type: "timestamptz", nullable: false } },
  plans: { id: { type: "uuid", nullable: false, primaryKey: true }, workspace_id: { type: "uuid", nullable: false, references: "workspaces.id" }, title: { type: "text", nullable: false }, start_date: { type: "date", nullable: false }, end_date: { type: "date", nullable: false }, priority: { type: "integer", nullable: false, range: [1, 5] }, success_criteria: { type: "text", nullable: false }, estimated_minutes: { type: "integer", nullable: false, minimum: 0 }, created_at: { type: "timestamptz", nullable: false }, updated_at: { type: "timestamptz", nullable: false }, archived_at: { type: "timestamptz", nullable: true } },
  plan_revisions: { id: { type: "uuid", nullable: false, primaryKey: true }, plan_id: { type: "uuid", nullable: false, references: "plans.id" }, revision_no: { type: "integer", nullable: false }, title: { type: "text", nullable: false }, start_date: { type: "date", nullable: false }, end_date: { type: "date", nullable: false }, priority: { type: "integer", nullable: false, range: [1, 5] }, success_criteria: { type: "text", nullable: false }, estimated_minutes: { type: "integer", nullable: false, minimum: 0 }, saved_at: { type: "timestamptz", nullable: false } },
  tasks: { id: { type: "uuid", nullable: false, primaryKey: true }, plan_id: { type: "uuid", nullable: false, references: "plans.id" }, title: { type: "text", nullable: false }, due_date: { type: "date", nullable: true }, priority: { type: "integer", nullable: false, range: [1, 5] }, tag: { type: "text", nullable: false }, estimated_minutes: { type: "integer", nullable: false, minimum: 0 }, status: { type: "text", nullable: false, values: ["todo", "in_progress", "done"], default: "todo" }, blocked_reason: { type: "text", nullable: true }, completed_at: { type: "timestamptz", nullable: true }, deleted_at: { type: "timestamptz", nullable: true, softDelete: true }, created_at: { type: "timestamptz", nullable: false }, updated_at: { type: "timestamptz", nullable: false } },
  execution_records: { id: { type: "uuid", nullable: false, primaryKey: true }, task_id: { type: "uuid", nullable: false, references: "tasks.id" }, started_at: { type: "timestamptz", nullable: false }, ended_at: { type: "timestamptz", nullable: false }, actual_minutes: { type: "integer", nullable: false, minimum: 0, calculatedFrom: "ended_at - started_at" }, missed_reason: { type: "text", nullable: true }, idempotency_key: { type: "uuid", nullable: false, unique: true }, created_at: { type: "timestamptz", nullable: false } },
  reviews: { id: { type: "uuid", nullable: false, primaryKey: true }, plan_id: { type: "uuid", nullable: false, references: "plans.id" }, correction_text: { type: "text", nullable: false }, next_plan_id: { type: "uuid", nullable: true, references: "plans.id" }, created_at: { type: "timestamptz", nullable: false } },
};

type RecordValue = Record<string, unknown>;

function record(value: unknown, name: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Schema contract ${name} must be an object.`);
  return value as RecordValue;
}
function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new Error(`Schema contract ${name} must be an array of strings.`);
  return value;
}
function equal(actual: unknown, expected: unknown, name: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Schema contract ${name} must equal ${JSON.stringify(expected)}.`);
}
function includes(actual: string[], expected: string, kind: string): void {
  if (!actual.includes(expected)) throw new Error(`Schema contract is missing required ${kind}: ${expected}`);
}
function verifyFields(contract: RecordValue): void {
  const definitions = record(contract.tableDefinitions, "tableDefinitions");
  for (const [table, expectedFields] of Object.entries(requiredFields)) {
    const fields = record(record(definitions[table], `tableDefinitions.${table}`).fields, `tableDefinitions.${table}.fields`);
    for (const [field, expected] of Object.entries(expectedFields)) {
      const actual = record(fields[field], `tableDefinitions.${table}.fields.${field}`);
      for (const [property, value] of Object.entries(expected)) equal(actual[property], value, `${table}.${field}.${property}`);
    }
  }
}

export function verifySchemaContract(contract: unknown): void {
  const value = record(contract, "root");
  equal(value.schemaVersion, "pds-schema-v2", "schemaVersion");
  equal(value.timezone, "Asia/Seoul", "timezone");
  const tables = strings(value.tables, "tables"); const relations = strings(value.relations, "relations"); const indexes = strings(value.indexes, "indexes");
  requiredTables.forEach((table) => includes(tables, table, "table")); requiredRelations.forEach((relation) => includes(relations, relation, "relation")); requiredIndexes.forEach((index) => includes(indexes, index, "index"));
  verifyFields(value);
  const definitions = record(value.tableDefinitions, "tableDefinitions");
  equal(strings(record(definitions.plans, "plans").constraints, "plans.constraints"), ["end_date >= start_date"], "plans.constraints");
  equal(strings(record(definitions.plan_revisions, "plan_revisions").constraints, "plan_revisions.constraints"), ["unique(plan_id, revision_no)", "end_date >= start_date"], "plan_revisions.constraints");
  equal(strings(record(definitions.execution_records, "execution_records").constraints, "execution_records.constraints"), ["ended_at >= started_at"], "execution_records.constraints");
  equal(strings(value.statusValues, "statusValues"), ["todo", "in_progress", "done"], "statusValues");
  equal(record(value.aggregationRules, "aggregationRules"), { timezone: "Asia/Seoul", excludeDeletedTasks: true, planTaskCount: "count(tasks where deleted_at is null)", completedCount: "count(tasks where deleted_at is null and status = done)", delayedCount: "count(tasks where deleted_at is null and status != done and due_date is before today in Asia/Seoul)", blockedCount: "count(tasks where deleted_at is null and trim(blocked_reason) != '')", expectedMinutes: "sum(tasks.estimated_minutes, default 0)", actualMinutes: "sum(execution_records.actual_minutes, default 0)", differenceMinutes: "actualMinutes - expectedMinutes", sourceTaskIds: ["plan", "completed", "delayed", "blocked"] }, "aggregationRules");
  equal(record(value.seedSafety, "seedSafety"), { workspaceSlug: "public", allowedTables: ["workspaces", "plans", "tasks"], forbiddenTables: ["execution_records", "plan_revisions", "reviews"], taskStatus: "todo", forbidExplicitTimestamps: true, forbidCompletedTasks: true }, "seedSafety");
}

export function verifySeedSafety(seed: string): void {
  const sql = seed.replace(/--[^\n]*/g, "").toLowerCase();
  for (const table of ["execution_records", "plan_revisions", "reviews"]) {
    if (new RegExp(`\\binsert\\s+into\\s+public\\.${table}\\b`).test(sql)) throw new Error(`Seed must not insert into ${table}.`);
  }
  if (/\b(status|completed_at|started_at|ended_at|created_at|updated_at|saved_at)\b/.test(sql)) throw new Error("Seed must not set task completion or timestamp fields.");
  if (/\b(done|in_progress)\b/.test(sql)) throw new Error("Seed must leave tasks at the database todo default.");
  const insertedTables = [...sql.matchAll(/\binsert\s+into\s+public\.([a-z_]+)/g)].map((match) => match[1]);
  if (insertedTables.some((table) => !["workspaces", "plans", "tasks"].includes(table))) throw new Error("Seed inserts an unapproved table.");
  if (!/\bslug\s*=\s*'public'/.test(sql) || !/'public'/.test(sql)) throw new Error("Seed must target the public workspace.");
}

function main(): void {
  const directory = dirname(fileURLToPath(import.meta.url));
  const contract = JSON.parse(readFileSync(resolve(directory, "../contracts/pds-schema-v2.json"), "utf8")) as unknown;
  verifySchemaContract(contract);
  verifySeedSafety(readFileSync(resolve(directory, "../supabase/seed.sql"), "utf8"));
  console.log("Schema contract verification passed.");
}

main();
