import type { ApiErrorCode } from "./contracts";

/** Errors the UI knows how to explain and recover from. */
export type ClientErrorCode =
  | ApiErrorCode
  | "network"
  | "timeout"
  | "contract_mismatch"
  | "backend_not_configured"
  | "aborted";

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(code: ClientErrorCode, message: string, options: { status?: number | null; retryAfterSeconds?: number | null; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }

  /** Whether trying again (without changing anything) might succeed. */
  get retryable() {
    return ["network", "timeout", "rate_limited", "unavailable", "internal"].includes(this.code);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new ApiError("aborted", "Request was cancelled");
  if (error instanceof DOMException && error.name === "TimeoutError") return new ApiError("timeout", "Request timed out");
  return new ApiError("network", error instanceof Error ? error.message : "Network error", { cause: error });
}
