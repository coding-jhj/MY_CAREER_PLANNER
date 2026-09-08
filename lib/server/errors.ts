export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  readonly code: "IDEMPOTENCY_CONFLICT" | "CONFLICT";

  constructor(message: string, code: "IDEMPOTENCY_CONFLICT" | "CONFLICT" = "CONFLICT") {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export class DatabaseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
  }
}

interface SupabaseErrorShape {
  code?: string;
  message?: string;
  details?: string;
}

export function translateSupabaseError(error: SupabaseErrorShape):
  | ConflictError
  | NotFoundError
  | ValidationError
  | DatabaseError {
  const detail = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (error.code === "23505") {
    if (detail.includes("idempotency_key")) {
      return new ConflictError("An execution with this idempotency key already exists", "IDEMPOTENCY_CONFLICT");
    }
    return new ConflictError("The requested change conflicts with existing data");
  }

  if (error.code === "P0001" && detail.includes("idempotency_key_task_mismatch")) {
    return new ConflictError("This idempotency key belongs to a different task", "IDEMPOTENCY_CONFLICT");
  }

  if (error.code === "23503") {
    return new ValidationError("Invalid related record");
  }

  if (error.code === "23514" || error.code === "22P02") {
    return new ValidationError("Invalid database input");
  }

  if (error.code === "PGRST116" || error.code === "P0002") {
    return new NotFoundError("Requested record was not found");
  }

  return new DatabaseError("Database operation failed", error);
}
