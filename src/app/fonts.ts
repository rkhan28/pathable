import localFont from "next/font/local";

/**
 * Typography system (all SIL OFL 1.1, self-hosted — no third-party font requests):
 * - Atkinson Hyperlegible Next: UI and body. Designed by the Braille Institute for
 *   low-vision readers; distinct letterforms (Il1, 0O) matter outdoors on a phone.
 * - Atkinson Hyperlegible Mono: distances, durations, percentages — figures stay aligned.
 * - Instrument Serif: editorial display headlines only (landing / marketing).
 * Non-Latin scripts fall back to system Noto/PingFang faces (see --font-sans in globals.css).
 */
export const atkinson = localFont({
  variable: "--font-atkinson",
  display: "swap",
  src: [
    // Three weights cover the whole UI (regular, medium labels, semibold emphasis); no italics are used.
    { path: "../fonts/atkinson-hyperlegible-next-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/atkinson-hyperlegible-next-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/atkinson-hyperlegible-next-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const atkinsonMono = localFont({
  variable: "--font-atkinson-mono",
  display: "swap",
  // Only used for a few numerals below the fold — don't compete with first paint.
  preload: false,
  src: [
    { path: "../fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/atkinson-hyperlegible-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

export const instrumentSerif = localFont({
  variable: "--font-instrument",
  display: "swap",
  src: [
    { path: "../fonts/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
  ],
  fallback: ["Georgia", "Times New Roman", "serif"],
});
