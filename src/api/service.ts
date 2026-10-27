import {
  AnalysisResponseSchema,
  HazardsResponseSchema,
  ReportReceiptSchema,
  RoutesResponseSchema,
  type AnalysisResponse,
  type HazardsResponse,
  type ReportReceipt,
  type ReportSubmission,
  type RouteRequest,
  type RoutesResponse,
} from "./contracts";
import { ApiError } from "./errors";
import { requestJson } from "./http";
import { env, getBackendMode, type BackendMode } from "@/lib/env";

export type Bbox = [west: number, south: number, east: number, north: number];

/**
 * Everything the frontend needs from the PathAble backend.
 * Documented in docs/API_CONTRACT.md. Two implementations exist:
 * - HttpPathAbleService: the real API.
 * - FixturePathAbleService: development-only, every payload marked
 *   `source: "development-fixture"` so the UI can label it.
 */
export interface PathAbleService {
  readonly mode: BackendMode;
  getRoutes(request: RouteRequest, signal?: AbortSignal): Promise<RoutesResponse>;
  getHazards(bbox: Bbox, signal?: AbortSignal): Promise<HazardsResponse>;
  analyzePhoto(image: Blob, signal?: AbortSignal): Promise<AnalysisResponse>;
  submitReport(report: ReportSubmission, signal?: AbortSignal): Promise<ReportReceipt>;
  withdrawReport(id: string, signal?: AbortSignal): Promise<ReportReceipt>;
}

export class HttpPathAbleService implements PathAbleService {
  readonly mode = "live" as const;
  constructor(private readonly baseUrl: string) {}

  getRoutes(request: RouteRequest, signal?: AbortSignal) {
    return requestJson(this.baseUrl, "v1/routes", RoutesResponseSchema, { method: "POST", body: request, signal });
  }

  getHazards([w, s, e, n]: Bbox, signal?: AbortSignal) {
    const bbox = [w, s, e, n].map((v) => v.toFixed(5)).join(",");
    return requestJson(this.baseUrl, `v1/hazards?bbox=${bbox}`, HazardsResponseSchema, { signal });
  }

  analyzePhoto(image: Blob, signal?: AbortSignal) {
    const form = new FormData();
    form.append("image", image, "report.jpg");
    return requestJson(this.baseUrl, "v1/reports/analyze", AnalysisResponseSchema, {
      method: "POST",
      body: form,
      signal,
      timeoutMs: 45_000,
    });
  }

  submitReport(report: ReportSubmission, signal?: AbortSignal) {
    return requestJson(this.baseUrl, "v1/reports", ReportReceiptSchema, { method: "POST", body: report, signal });
  }

  withdrawReport(id: string, signal?: AbortSignal) {
    return requestJson(this.baseUrl, `v1/reports/${encodeURIComponent(id)}/withdraw`, ReportReceiptSchema, {
      method: "POST",
      signal,
    });
  }
}

const notConfigured = () =>
  Promise.reject(new ApiError("backend_not_configured", "The PathAble backend is not connected in this environment."));

/** No backend and fixtures disabled: every call fails with an explainable error. */
export class UnavailablePathAbleService implements PathAbleService {
  readonly mode = "unavailable" as const;
  getRoutes = notConfigured;
  getHazards = notConfigured;
  analyzePhoto = notConfigured;
  submitReport = notConfigured;
  withdrawReport = notConfigured;
}

let instance: PathAbleService | null = null;

export async function getService(): Promise<PathAbleService> {
  if (instance) return instance;
  const mode = getBackendMode();
  if (mode === "live") instance = new HttpPathAbleService(env.apiUrl!);
  else if (mode === "fixtures") {
    // Loaded lazily so fixture code never ships in the critical path of a live build.
    const { FixturePathAbleService } = await import("./fixtures/fixture-service");
    instance = new FixturePathAbleService();
  } else instance = new UnavailablePathAbleService();
  return instance;
}

/** Test seam. */
export function __setService(service: PathAbleService | null) {
  instance = service;
}
