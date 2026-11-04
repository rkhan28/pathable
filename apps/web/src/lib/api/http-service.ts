import type { z } from "zod";
import {
  AnalysisResponse,
  ApiError,
  HazardsResponse,
  PhotoReceipt,
  ReportReceipt,
  RouteResponse,
  TransitResponse,
  type ReportCreate,
  type TransitRequest,
  type RouteRequest,
} from "./contracts";
import { PathAbleError } from "./errors";
import type { PathAbleService } from "./service";

/** Parse a response with its schema; anything that does not match is rejected, never rendered. */
export async function parseResponse<T extends z.ZodType>(res: Response, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new PathAbleError("contract_mismatch", false);
  }
  if (!res.ok) {
    const err = ApiError.safeParse(body);
    if (err.success) throw new PathAbleError(err.data.error.code, err.data.error.retryable, err.data.error.requestId);
    throw new PathAbleError(res.status >= 500 ? "unavailable" : "contract_mismatch", res.status >= 500);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") console.error("Contract mismatch", parsed.error.issues.slice(0, 5));
    throw new PathAbleError("contract_mismatch", false);
  }
  return parsed.data;
}

export function createHttpService(baseUrl: string, fetchImpl: typeof fetch = fetch): PathAbleService {
  const url = (path: string) => new URL(path, baseUrl).toString();
  // A sleeping free-tier instance can take about a minute to wake; give up after 90 s.
  const TIMEOUT_MS = 90_000;
  const send = async (path: string, init?: RequestInit) => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      return await fetchImpl(url(path), { ...init, signal });
    } catch (e) {
      if ((e as Error).name === "AbortError" && !timeout.aborted) throw e;
      throw new PathAbleError(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "unavailable", true);
    }
  };
  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    kind: "live",
    async routes(request: RouteRequest, signal?: AbortSignal) {
      return parseResponse(await send("/v1/routes", { ...json(request), signal }), RouteResponse);
    },
    async transit(request: TransitRequest, signal?: AbortSignal) {
      return parseResponse(await send("/v1/transit", { ...json(request), signal }), TransitResponse);
    },
    async hazards(bbox, signal) {
      return parseResponse(await send(`/v1/hazards?bbox=${bbox.join(",")}`, { signal }), HazardsResponse);
    },
    async uploadPhoto(photo: Blob) {
      const form = new FormData();
      form.append("photo", photo, "photo.jpg");
      return parseResponse(await send("/v1/photos", { method: "POST", body: form }), PhotoReceipt);
    },
    async createReport(report: ReportCreate) {
      return parseResponse(await send("/v1/reports", json(report)), ReportReceipt);
    },
    async withdrawReport(id: string, withdrawToken: string) {
      return parseResponse(await send(`/v1/reports/${encodeURIComponent(id)}/withdraw`, json({ withdrawToken })), ReportReceipt);
    },
    async analyzePhoto(photo: Blob) {
      const form = new FormData();
      form.append("photo", photo);
      return parseResponse(await send("/v1/reports/analyze", { method: "POST", body: form }), AnalysisResponse);
    },
  };
}
