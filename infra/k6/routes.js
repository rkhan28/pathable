// Latency benchmark for the published targets: /v1/routes p95 < 300 ms and
// p99 < 800 ms on corridor trips; /v1/hazards p95 < 100 ms.
// Run with `make bench`, which lifts the API's rate limits for the run (at the
// default 60 a minute most requests would be 429s) and saves the summary.
//
// Latency thresholds count only successful responses: a fast 429 or 422 must
// not make the numbers look better. Failures have their own threshold.
import http from "k6/http";
import { check } from "k6";
import { SharedArray } from "k6/data";

const API = __ENV.API_URL || "http://localhost:8000";
const trips = new SharedArray("trips", () => JSON.parse(open(__ENV.TRIPS || "./trips.json")));
// The three demo trips end to end; the corridor one is about 10 km of walking.
const demo = new SharedArray("demo", () => JSON.parse(open("./trips-demo.json")));
const prefs = JSON.parse(open("../../contracts/fixtures/default-preferences.json"));

export const options = {
  scenarios: {
    routes: { executor: "constant-vus", vus: 4, duration: "60s", exec: "routes" },
    hazards: { executor: "constant-vus", vus: 2, duration: "60s", exec: "hazards" },
    // DEMO=0 leaves it out, for the profile the earlier published runs used.
    ...(__ENV.DEMO === "0" ? {} : { demo: { executor: "constant-vus", vus: 1, duration: "60s", exec: "demoTrips" } }),
  },
  thresholds: {
    "http_req_duration{scenario:routes,expected_response:true}": ["p(95)<300", "p(99)<800"],
    "http_req_duration{scenario:hazards,expected_response:true}": ["p(95)<100"],
    // Reported, not a target: the published target is for corridor trips like those above.
    ...(__ENV.DEMO === "0" ? {} : { "http_req_duration{scenario:demo,expected_response:true}": ["p(95)<2000"] }),
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// Every API worker loads its graph lazily on first use; warm them all before measuring.
export function setup() {
  for (let i = 0; i < 24; i++) {
    const t = trips[i % trips.length];
    http.post(`${API}/v1/routes`, JSON.stringify({ origin: t.origin, destination: t.destination, preferences: prefs }), {
      headers: { "content-type": "application/json" },
      tags: { name: "warmup" },
      responseCallback: http.expectedStatuses(200, 429),
    });
  }
}

export function demoTrips() {
  const t = demo[Math.floor(Math.random() * demo.length)];
  const res = http.post(`${API}/v1/routes`, JSON.stringify({ origin: t.origin, destination: t.destination, preferences: prefs }), {
    headers: { "content-type": "application/json" },
  });
  check(res, { "demo route 200": (r) => r.status === 200 });
}

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
