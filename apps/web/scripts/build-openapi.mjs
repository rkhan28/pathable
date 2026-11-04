#!/usr/bin/env node
// Generate contracts/openapi.json (OpenAPI 3.1) from the Zod contract, the
// single source of truth. The API's contract tests validate every response
// against these schemas; CI fails if this file is stale.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import * as c from "../src/lib/api/contracts.ts";

const schemas = {
  RouteRequest: c.RouteRequest,
  RouteResponse: c.RouteResponse,
  HazardsResponse: c.HazardsResponse,
  ReportCreate: c.ReportCreate,
  ReportReceipt: c.ReportReceipt,
  WithdrawRequest: c.WithdrawRequest,
  PhotoReceipt: c.PhotoReceipt,
  TransitRequest: c.TransitRequest,
  TransitResponse: c.TransitResponse,
  AnalysisResponse: c.AnalysisResponse,
  ApiError: c.ApiError,
  Preferences: c.Preferences,
};
const components = Object.fromEntries(
  Object.entries(schemas).map(([name, s]) => [name, z.toJSONSchema(s, { target: "draft-2020-12", io: "output" })]),
);
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (name) => ({ content: { "application/json": { schema: ref(name) } } });
const errors = Object.fromEntries(["400", "404", "422", "429", "500", "503"].map((code) => [code, { description: "Error", ...json("ApiError") }]));

const doc = {
  openapi: "3.1.0",
  info: { title: "PathAble API", version: "1.0.0", description: "Generated from apps/web/src/lib/api/contracts.ts. Do not edit." },
  paths: {
    "/v1/routes": { post: { operationId: "routes", requestBody: { required: true, ...json("RouteRequest") }, responses: { 200: { description: "Ranked alternatives", ...json("RouteResponse") }, ...errors } } },
    "/v1/transit": {
      post: { operationId: "transit", requestBody: { required: true, ...json("TransitRequest") }, responses: { 200: { description: "Up to three accessible walk-ride-walk options", ...json("TransitResponse") }, ...errors } },
    },
    "/v1/hazards": {
      get: {
        operationId: "hazards",
        parameters: [{ name: "bbox", in: "query", required: true, schema: { type: "string", pattern: "^-?\\d+(\\.\\d+)?(,-?\\d+(\\.\\d+)?){3}$" } }],
        responses: { 200: { description: "Unexpired hazards", ...json("HazardsResponse") }, ...errors },
      },
    },
    "/v1/reports": { post: { operationId: "createReport", requestBody: { required: true, ...json("ReportCreate") }, responses: { 201: { description: "Received", ...json("ReportReceipt") }, ...errors } } },
    "/v1/photos": {
      post: {
        operationId: "uploadPhoto",
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["photo"], properties: { photo: { type: "string", format: "binary" } } } } } },
        responses: { 201: { description: "Stored privately, metadata removed", ...json("PhotoReceipt") }, ...errors },
      },
    },
    "/v1/reports/{id}/withdraw": {
      post: {
        operationId: "withdrawReport",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, ...json("WithdrawRequest") },
        responses: { 200: { description: "Withdrawn", ...json("ReportReceipt") }, ...errors },
      },
    },
    "/v1/reports/analyze": { post: { operationId: "analyzePhoto", responses: { 200: { description: "Analysis or unavailable", ...json("AnalysisResponse") }, ...errors } } },
  },
  components: { schemas: components },
};
const out = fileURLToPath(new URL("../../../contracts/openapi.json", import.meta.url));
mkdirSync(fileURLToPath(new URL("../../../contracts/", import.meta.url)), { recursive: true });
writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote contracts/openapi.json (${Object.keys(components).length} schemas)`);
