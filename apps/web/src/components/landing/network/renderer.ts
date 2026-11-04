import type { NetworkData, StateCode } from "@/lib/hero-network";

/**
 * Draws the landing's live street network on a canvas: the corridor's real
 * sidewalks coloured by what is known about them, people-like pulses moving
 * along them, and the planner's routes drawing themselves one after another.
 *
 * Written to run inside a worker on an OffscreenCanvas (so the page itself
 * never waits on it), or on the main thread as a fallback. Each frame is two
 * image copies and a handful of batched strokes, whatever the number of pulses:
 *
 *   base   - the network, drawn once per size or theme change
 *   trails - pulses, faded a little each frame so they leave short tails
 *   screen - base + trails + the route being drawn + the start and end rings
 */

export interface Palette {
  dark: boolean;
  verified: string;
  barrier: string;
  unverified: string;
  unknown: string;
  signal: string;
}

export interface Size {
  width: number;
  height: number;
  dpr: number;
}

export interface NetworkOptions {
  palette: Palette;
  size: Size;
  reduced: boolean;
  onShow?: (index: number) => void;
  onReady?: () => void;
}

export interface Network {
  resize(size: Size): void;
  setPalette(palette: Palette): void;
  play(): void;
  pause(): void;
  destroy(): void;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Edge {
  pts: Float32Array;
  cum: Float32Array;
  len: number;
  state: StateCode;
  /** Edges touching each end, for pulses to carry on along. */
  next: [number[], number[]];
}

interface Pulse {
  e: number;
  i: number;
  s: number;
  dir: 1 | -1;
  v: number;
  x: number;
  y: number;
}

/** One route: legs placed end to end, with where each starts along the whole. */
interface Show {
  legs: { ride: boolean; color: string | null; pts: Float32Array; cum: Float32Array; start: number; len: number }[];
  len: number;
}

const DRAW_MS = 2600;
const HOLD_MS = 1900;
const FADE_MS = 700;
const GAP_MS = 300;
const SHOW_MS = DRAW_MS + HOLD_MS + FADE_MS + GAP_MS;
const RING_MS = 2200;
const STATES: StateCode[] = ["u", "r", "b", "v"];

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function measure(flat: number[]) {
  const pts = Float32Array.from(flat);
  const cum = new Float32Array(pts.length / 2);
  for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  return { pts, cum, len: cum[cum.length - 1] };
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** A small soft dot, drawn once and stamped wherever a route's head is. */
function makeGlow(color: string, radius: number): AnyCanvas {
  const size = Math.ceil(radius * 2);
  const c = makeCanvas(size, size);
  const g = c.getContext("2d") as Ctx;
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "transparent");
  g.globalAlpha = 0.9;
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function createNetwork(canvas: AnyCanvas, data: NetworkData, options: NetworkOptions): Network {
  const ctx = canvas.getContext("2d") as Ctx;
  let palette = options.palette;
  let size = options.size;
  const reduced = options.reduced;

  // ---- The graph, and which edges meet at each end ----
  const edges: Edge[] = data.edges.map(([state, ...flat]) => ({ ...measure(flat), state, next: [[], []] }));
  const ends = new Map<string, number[]>();
  const key = (x: number, y: number) => `${x},${y}`;
  edges.forEach((e, i) => {
    for (const at of [0, e.pts.length - 2]) {
      const k = key(e.pts[at], e.pts[at + 1]);
      const list = ends.get(k) ?? [];
      list.push(i);
      ends.set(k, list);
    }
  });
  edges.forEach((e, i) => {
    e.next[0] = (ends.get(key(e.pts[0], e.pts[1])) ?? []).filter((j) => j !== i);
    e.next[1] = (ends.get(key(e.pts[e.pts.length - 2], e.pts[e.pts.length - 1])) ?? []).filter((j) => j !== i);
  });
  const totalLen = edges.reduce((sum, e) => sum + e.len, 0);

  const shows: Show[] = data.shows.map((s) => {
    let start = 0;
    const legs = s.legs.map((l) => {
      const m = measure(l.p);
      const leg = { ride: l.kind === "ride", color: l.color ?? null, pts: m.pts, cum: m.cum, start, len: m.len };
      start += m.len;
      return leg;
    });
    return { legs, len: start };
  });

  // ---- Layers and the plane-to-pixel fit ----
  let base = makeCanvas(1, 1);
  let trails = makeCanvas(1, 1);
  let k = 1;
  let ox = 0;
  let oy = 0;
  let glow = makeGlow(palette.signal, 12);

  function fit() {
    const w = Math.max(1, Math.round(size.width * size.dpr));
    const h = Math.max(1, Math.round(size.height * size.dpr));
    canvas.width = w;
    canvas.height = h;
    k = Math.min(w / data.w, h / data.h);
    ox = (w - data.w * k) / 2;
    oy = (h - data.h * k) / 2;
    base = makeCanvas(w, h);
    trails = makeCanvas(w, h);
    glow = makeGlow(palette.signal, 12 * size.dpr);
    drawBase();
  }

  function colorOf(state: StateCode) {
    return state === "v" ? palette.verified : state === "b" ? palette.barrier : state === "r" ? palette.unverified : palette.unknown;
  }

  function drawBase() {
    const g = base.getContext("2d") as Ctx;
    g.clearRect(0, 0, base.width, base.height);
    g.lineCap = "round";
    g.lineJoin = "round";
    // Unknown first and faintest, so what is known reads on top of it.
    for (const state of STATES) {
      g.beginPath();
      for (const e of edges) {
        if (e.state !== state) continue;
        g.moveTo(ox + e.pts[0] * k, oy + e.pts[1] * k);
        for (let i = 2; i < e.pts.length; i += 2) g.lineTo(ox + e.pts[i] * k, oy + e.pts[i + 1] * k);
      }
      g.strokeStyle = colorOf(state);
      g.globalAlpha = state === "u" ? (palette.dark ? 0.28 : 0.3) : palette.dark ? 0.75 : 0.7;
      g.lineWidth = (state === "u" ? 0.9 : 1.4) * size.dpr;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ---- Pulses: spread over the network by length, each walking at its own pace ----
  const area = size.width * size.height;
  const count = Math.round(Math.min(380, Math.max(160, area / 900)));
  function place(p: Pulse) {
    const e = edges[p.e];
    while (p.i < e.cum.length - 2 && e.cum[p.i + 1] < p.s) p.i++;
    while (p.i > 0 && e.cum[p.i] > p.s) p.i--;
    const a = e.cum[p.i];
    const span = e.cum[p.i + 1] - a || 1;
    const t = (p.s - a) / span;
    p.x = e.pts[p.i * 2] + (e.pts[p.i * 2 + 2] - e.pts[p.i * 2]) * t;
    p.y = e.pts[p.i * 2 + 1] + (e.pts[p.i * 2 + 3] - e.pts[p.i * 2 + 1]) * t;
  }
  function spawn(): Pulse {
    let r = Math.random() * totalLen;
    let e = 0;
    while (e < edges.length - 1 && r > edges[e].len) r -= edges[e++].len;
    const p: Pulse = { e, i: 0, s: r, dir: Math.random() < 0.5 ? 1 : -1, v: 0.018 + Math.random() * 0.03, x: 0, y: 0 };
    place(p);
    return p;
  }
  const pulses = Array.from({ length: count }, spawn);
  const prevX = new Float32Array(count);
  const prevY = new Float32Array(count);

  function step(p: Pulse, dt: number) {
    let e = edges[p.e];
    p.s += p.dir * p.v * dt;
    // Off the end: carry on along a random edge meeting there, or turn back at a dead end.
    if (p.s > e.len || p.s < 0) {
      const atEnd = p.s > e.len ? 1 : 0;
      const choices = e.next[atEnd];
      if (choices.length) {
        const n = choices[(Math.random() * choices.length) | 0];
        const ne = edges[n];
        const x = atEnd ? e.pts[e.pts.length - 2] : e.pts[0];
        const y = atEnd ? e.pts[e.pts.length - 1] : e.pts[1];
        const fromStart = ne.pts[0] === x && ne.pts[1] === y;
        p.e = n;
        p.dir = fromStart ? 1 : -1;
        p.s = fromStart ? 0 : ne.len;
        p.i = fromStart ? 0 : ne.cum.length - 2;
        e = ne;
      } else {
        p.dir = -p.dir as 1 | -1;
        p.s = Math.min(e.len, Math.max(0, p.s));
      }
    }
    place(p);
  }

  function drawPulses(dt: number) {
    const g = trails.getContext("2d") as Ctx;
    // Fade what is there, at the same rate whatever the frame rate.
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.9, dt / 16.7)})`;
    g.fillRect(0, 0, trails.width, trails.height);
    g.globalCompositeOperation = palette.dark ? "lighter" : "source-over";
    g.lineCap = "round";
    g.lineWidth = 1.9 * size.dpr;
    // Move everyone first, then draw one stroke per colour, however many pulses.
    for (let j = 0; j < pulses.length; j++) {
      prevX[j] = ox + pulses[j].x * k;
      prevY[j] = oy + pulses[j].y * k;
      step(pulses[j], dt);
    }
    for (const state of STATES) {
      g.beginPath();
      for (let j = 0; j < pulses.length; j++) {
        const p = pulses[j];
        if (edges[p.e].state !== state) continue;
        g.moveTo(prevX[j], prevY[j]);
        g.lineTo(ox + p.x * k, oy + p.y * k);
      }
      g.strokeStyle = state === "u" ? palette.signal : colorOf(state);
      g.globalAlpha = state === "u" ? 0.55 : 0.95;
      g.stroke();
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /** Trace a leg from its start up to `upTo` along it; returns the last point drawn. */
  function trace(g: Ctx, leg: Show["legs"][number], upTo: number): [number, number] {
    g.moveTo(ox + leg.pts[0] * k, oy + leg.pts[1] * k);
    let x = leg.pts[0];
    let y = leg.pts[1];
    for (let i = 1; i < leg.cum.length; i++) {
      if (leg.cum[i] <= upTo) {
        x = leg.pts[i * 2];
        y = leg.pts[i * 2 + 1];
      } else {
        const t = (upTo - leg.cum[i - 1]) / (leg.cum[i] - leg.cum[i - 1] || 1);
        x = leg.pts[i * 2 - 2] + (leg.pts[i * 2] - leg.pts[i * 2 - 2]) * t;
        y = leg.pts[i * 2 - 1] + (leg.pts[i * 2 + 1] - leg.pts[i * 2 - 1]) * t;
        g.lineTo(ox + x * k, oy + y * k);
        break;
      }
      g.lineTo(ox + x * k, oy + y * k);
    }
    return [x, y];
  }

  function drawShow(show: Show, reveal: number, alpha: number) {
    const g = ctx;
    const upTo = show.len * reveal;
    let head: [number, number] | null = null;
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const pass of [0, 1]) {
      for (const leg of show.legs) {
        if (upTo <= leg.start) break;
        g.beginPath();
        const end = trace(g, leg, Math.min(leg.len, upTo - leg.start));
        const color = leg.ride && leg.color ? leg.color : palette.signal;
        g.strokeStyle = color;
        // A wide faint pass under a narrow bright one reads as a glow, without the cost of a blur.
        g.globalAlpha = alpha * (pass === 0 ? 0.2 : 1);
        g.lineWidth = (pass === 0 ? 11 : leg.ride ? 4.5 : 3.2) * size.dpr;
        g.setLineDash(pass === 1 && !leg.ride && show.legs.length > 1 ? [0.1, 7 * size.dpr] : []);
        g.stroke();
        head = end;
      }
    }
    g.setLineDash([]);
    if (head && reveal < 1) {
      g.globalAlpha = alpha;
      g.drawImage(glow, ox + head[0] * k - glow.width / 2, oy + head[1] * k - glow.height / 2);
    }
    g.globalAlpha = 1;
  }

  function drawEnds(now: number) {
    const g = ctx;
    const dpr = size.dpr;
    for (const [i, [x, y]] of [data.origin, data.destination].entries()) {
      const cx = ox + x * k;
      const cy = oy + y * k;
      if (!reduced) {
        for (const offset of [0, RING_MS / 2]) {
          const t = ((now + offset + i * 500) % RING_MS) / RING_MS;
          g.beginPath();
          g.arc(cx, cy, (5 + 24 * t) * dpr, 0, Math.PI * 2);
          g.strokeStyle = palette.signal;
          g.globalAlpha = (1 - t) * 0.6;
          g.lineWidth = 1.5 * dpr;
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.beginPath();
      g.arc(cx, cy, (i ? 6 : 5) * dpr, 0, Math.PI * 2);
      g.fillStyle = i ? palette.signal : palette.dark ? "#0b0f0d" : "#ffffff";
      g.fill();
      g.lineWidth = 2.5 * dpr;
      g.strokeStyle = palette.signal;
      g.stroke();
    }
  }

  // ---- The loop ----
  const raf: (cb: (t: number) => void) => number =
    typeof requestAnimationFrame === "function" ? requestAnimationFrame.bind(globalThis) : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  const caf: (id: number) => void = typeof cancelAnimationFrame === "function" ? cancelAnimationFrame.bind(globalThis) : (id) => clearTimeout(id);
  let frame = 0;
  let running = false;
  let last = 0;
  /** Time on the show clock; it only advances while playing, so a paused hero resumes where it left off. */
  let clock = 0;
  let shown = -1;
  let readySent = false;

  function render(now: number, dt: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    if (!reduced) {
      drawPulses(dt);
      ctx.drawImage(trails, 0, 0);
    }
    if (shows.length) {
      const index = reduced ? 0 : Math.floor(clock / SHOW_MS) % shows.length;
      const local = reduced ? DRAW_MS : clock % SHOW_MS;
      const reveal = easeInOut(Math.min(1, local / DRAW_MS));
      const fadeAt = DRAW_MS + HOLD_MS;
      const alpha = local < fadeAt ? 1 : Math.max(0, 1 - (local - fadeAt) / FADE_MS);
      if (alpha > 0) drawShow(shows[index], reveal, alpha);
      if (index !== shown) {
        shown = index;
        options.onShow?.(index);
      }
    }
    drawEnds(now);
    if (!readySent) {
      readySent = true;
      options.onReady?.();
    }
  }

  function tick(now: number) {
    if (!running) return;
    const dt = Math.min(50, last ? now - last : 16.7);
    last = now;
    clock += dt;
    render(now, dt);
    frame = raf(tick);
  }

  fit();

  return {
    resize(next) {
      size = next;
      fit();
      if (!running) render(performance.now(), 0);
    },
    setPalette(next) {
      palette = next;
      fit();
      if (!running) render(performance.now(), 0);
    },
    play() {
      if (reduced) {
        render(performance.now(), 0);
        return;
      }
      if (running) return;
      running = true;
      last = 0;
      frame = raf(tick);
    },
    pause() {
      running = false;
      caf(frame);
    },
    destroy() {
      running = false;
      caf(frame);
    },
  };
}
