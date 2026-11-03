import type {
  AnalysisResponse,
  HazardsResponse,
  PhotoReceipt,
  ReportCreate,
  ReportReceipt,
  RouteRequest,
  RouteResponse,
  TransitRequest,
  TransitResponse,
} from "./contracts";

export type ServiceKind = "live" | "development-fixture" | "unavailable";

/** One interface, three implementations: live HTTP, labelled fixtures, unavailable. */
export interface PathAbleService {
  readonly kind: ServiceKind;
  routes(request: RouteRequest, signal?: AbortSignal): Promise<RouteResponse>;
  /** Accessible bus, streetcar, LRT and subway options: walk, ride one vehicle, walk. */
  transit(request: TransitRequest, signal?: AbortSignal): Promise<TransitResponse>;
  hazards(bbox: [number, number, number, number], signal?: AbortSignal): Promise<HazardsResponse>;
  uploadPhoto(photo: Blob): Promise<PhotoReceipt>;
  createReport(report: ReportCreate): Promise<ReportReceipt>;
  withdrawReport(id: string): Promise<ReportReceipt>;
  analyzePhoto(photo: Blob): Promise<AnalysisResponse>;
}
