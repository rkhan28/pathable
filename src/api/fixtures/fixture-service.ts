import type { AnalysisResponse, HazardsResponse, ReportReceipt, RouteRequest, RoutesResponse } from "../contracts";
import { ApiError } from "../errors";
import type { Bbox, PathAbleService } from "../service";
import { generateFixtureHazards, generateFixtureRoutes } from "./routes";

const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * Development-only service. Routes and hazards are synthetic and labelled as such.
 * Photo analysis and report submission are NOT simulated: inventing model output
 * or pretending a report reached the server would be dishonest, so those calls
 * fail with explainable errors and the UI falls back to manual / local-draft flows.
 */
export class FixturePathAbleService implements PathAbleService {
  readonly mode = "fixtures" as const;

  async getRoutes(request: RouteRequest, signal?: AbortSignal): Promise<RoutesResponse> {
    await delay(450, signal);
    return generateFixtureRoutes(request);
  }

  async getHazards(bbox: Bbox, signal?: AbortSignal): Promise<HazardsResponse> {
    await delay(150, signal);
    return { source: "development-fixture", generatedAt: new Date().toISOString(), hazards: generateFixtureHazards(bbox) };
  }

  analyzePhoto(): Promise<AnalysisResponse> {
    return Promise.reject(
      new ApiError("unavailable", "Photo analysis needs the PathAble ML service, which isn't connected in this development build."),
    );
  }

  submitReport(): Promise<ReportReceipt> {
    return Promise.reject(new ApiError("backend_not_configured", "Reports can't be sent until the PathAble backend is connected."));
  }

  withdrawReport(): Promise<ReportReceipt> {
    return Promise.reject(new ApiError("backend_not_configured", "Reports can't be withdrawn until the PathAble backend is connected."));
  }
}
