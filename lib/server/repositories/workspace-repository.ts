import type { SupabaseClient } from "@supabase/supabase-js";

import type { Workspace } from "../../domain/types";
import { DatabaseError, translateSupabaseError } from "../errors";
import type { WorkspaceRepository } from "./contracts";

type Row = Record<string, unknown>;

function requiredString(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string") throw new DatabaseError(`Malformed workspaces row: ${field}`);
  return value;
}

function mapWorkspace(row: Row): Workspace {
  return {
    id: requiredString(row, "id"),
    slug: requiredString(row, "slug"),
    title: requiredString(row, "title"),
    timezone: requiredString(row, "timezone"),
    createdAt: requiredString(row, "created_at"),
  };
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getBySlug(slug: string): Promise<Workspace | null> {
    const { data, error } = await this.client.from("workspaces").select("*").eq("slug", slug).maybeSingle();
    if (error) throw translateSupabaseError(error);
    return data ? mapWorkspace(data as Row) : null;
  }
}
