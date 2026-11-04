import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The only other origins the browser talks to: the API, map tiles, fonts and
// sprites (OpenFreeMap), and place search (Photon). Fonts and the map's worker
// are served from this site.
// Each follows the same environment variable the app reads, so overriding a host updates the policy too.
const origin = (url: string | undefined, fallback = "") => (url ? new URL(url.replace(/\{[^}]+\}/g, "x")).origin : fallback);
const api = origin(process.env.NEXT_PUBLIC_PATHABLE_API_URL);
const tiles = [...new Set([origin(process.env.NEXT_PUBLIC_MAP_TILES, "https://tiles.openfreemap.org"), origin(process.env.NEXT_PUBLIC_MAP_GLYPHS, "https://tiles.openfreemap.org")])].join(" ");
const geocoder = origin(process.env.NEXT_PUBLIC_GEOCODER_URL, "https://photon.komoot.io");
const dev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js streams its page data in inline scripts, and the theme is applied by an inline
  // script before first paint. Nonces would make every page dynamic, so inline scripts are
  // allowed, but only this site's own; `next dev` also needs eval for fast refresh.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${tiles}`,
  "font-src 'self' data:",
  `connect-src 'self' ${api} ${tiles} ${geocoder}`.replace(/\s+/g, " "),
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(api.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Keep `next dev` from writing generated guidance files into the project.
  agentRules: false,
  output: "standalone",
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
