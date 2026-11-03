import type { ErrorCode } from "./contracts";

/** Every failure the UI can show. Messages are rendered from `code`, never from the server. */
export class PathAbleError extends Error {
  constructor(
    readonly code: ErrorCode | "contract_mismatch" | "offline",
    readonly retryable: boolean,
    readonly requestId?: string,
  ) {
    super(code);
    this.name = "PathAbleError";
  }
}

export function isRetryable(error: unknown): boolean {
  return error instanceof PathAbleError ? error.retryable : false;
}
