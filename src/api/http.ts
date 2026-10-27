import type { z } from "zod";
import { ApiErrorBodySchema } from "./contracts";
import { ApiError, toApiError } from "./errors";

const DEFAULT_TIMEOUT_MS = 15_000;

interface RequestOptions extends Omit<RequestInit, "body" | "signal"> {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Typed fetch: every response is validated against its zod schema.
 * A response that doesn't match the contract is treated as an error, never
 * passed through — wrong accessibility data is worse than no data.
 */
export async function requestJson<S extends z.ZodType>(
  baseUrl: string,
  path: string,
  schema: S,
  { body, signal, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...init }: RequestOptions = {},
): Promise<z.infer<S>> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: combined,
    });
  } catch (error) {
    if (timeout.aborted && !signal?.aborted) throw new ApiError("timeout", "The PathAble service took too long to respond.");
    throw toApiError(error);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(payload);
    const retryAfter = Number(response.headers.get("Retry-After")) || null;
    if (parsed.success) {
      throw new ApiError(parsed.data.error.code, parsed.data.error.message, {
        status: response.status,
        retryAfterSeconds: parsed.data.error.retryAfterSeconds ?? retryAfter,
      });
    }
    throw new ApiError(response.status >= 500 ? "unavailable" : "invalid_request", `HTTP ${response.status}`, {
      status: response.status,
      retryAfterSeconds: retryAfter,
    });
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    if (process.env.NODE_ENV !== "production") console.error("[PathAble] API contract mismatch", path, result.error.issues);
    throw new ApiError("contract_mismatch", `Response from ${path} did not match the API contract.`, { cause: result.error });
  }
  return result.data;
}
