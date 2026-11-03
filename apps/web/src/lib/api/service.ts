import type {
  AnalysisResponse,
  HazardsResponse,
  ReportCreate,
  ReportReceipt,
  RouteRequest,
  RouteResponse,
} from "./contracts";

export type ServiceKind = "live" | "development-fixture" | "unavailable";

/** One interface, three implementations: live HTTP, labelled fixtures, unavailable. */
export interface PathAbleService {
  readonly kind: ServiceKind;
  routes(request: RouteRequest, signal?: AbortSignal): Promise<RouteResponse>;
  hazards(bbox: [number, number, number, number], signal?: AbortSignal): Promise<HazardsResponse>;
  createReport(report: ReportCreate): Promise<ReportReceipt>;
  withdrawReport(id: string): Promise<ReportReceipt>;
  analyzePhoto(photo: Blob): Promise<AnalysisResponse>;
}
