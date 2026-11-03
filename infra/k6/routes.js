// Latency benchmark for the published targets: /v1/routes p95 < 300 ms and
// p99 < 800 ms on corridor trips; /v1/hazards p95 < 100 ms.
// Run against a loaded API: k6 run infra/k6/routes.js (API_URL to override).
import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const API = __ENV.API_URL || "http://localhost:8000";
const trips = new SharedArray("trips", () => JSON.parse(open(__ENV.TRIPS || "./trips.json")));
const prefs = JSON.parse(open("../../contracts/fixtures/default-preferences.json"));

export const options = {
  scenarios: {
    routes: { executor: "constant-vus", vus: 4, duration: "60s", exec: "routes" },
    hazards: { executor: "constant-vus", vus: 2, duration: "60s", exec: "hazards" },
  },
  thresholds: {
    "http_req_duration{scenario:routes}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{scenario:hazards}": ["p(95)<100"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

export function routes() {
  const t = trips[Math.floor(Math.random() * trips.length)];
  const res = http.post(`${API}/v1/routes`, JSON.stringify({ origin: t.origin, destination: t.destination, preferences: prefs }), {
    headers: { "content-type": "application/json" },
  });
  check(res, { "route 200": (r) => r.status === 200 });
}

export function hazards() {
  const t = trips[Math.floor(Math.random() * trips.length)];
  const [x, y] = t.origin;
  const res = http.get(`${API}/v1/hazards?bbox=${x - 0.01},${y - 0.01},${x + 0.01},${y + 0.01}`);
  check(res, { "hazards 200": (r) => r.status === 200 });
}
