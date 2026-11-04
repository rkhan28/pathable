import { describe, expect, it, vi } from "vitest";
import { createHttpService, traceHeaders } from "./http-service";

describe("trace context", () => {
  it("is a valid W3C traceparent whose trace id is also the request id", () => {
    const h = traceHeaders();
    expect(h.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(h.traceparent.split("-")[1]).toBe(h["x-request-id"]);
    expect(traceHeaders().traceparent).not.toBe(h.traceparent);
  });

  it("goes with every API call, alongside the call's own headers", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: "unavailable", reason: "no_model" }), { status: 200 }));
    const service = createHttpService("http://api.test", fetchImpl as unknown as typeof fetch);
    await service.coverage().catch(() => {});
    await service.createReport({ kind: "obstacle", location: [-79.49, 43.77], description: "", photoId: null, observedOn: "2026-11-04" }).catch(() => {});
    const [, first] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const [, second] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect((first.headers as Record<string, string>).traceparent).toBeDefined();
    expect((second.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect((second.headers as Record<string, string>).traceparent).toBeDefined();
  });
});
