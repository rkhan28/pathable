import localFont from "next/font/local";

// Only the weights the design uses: 400 and 700, Latin + Latin Extended.
export const atkinson = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-next-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-next-latin-ext-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-atkinson",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const atkinsonMono = localFont({
  src: [
    { path: "./fonts/atkinson-hyperlegible-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/atkinson-hyperlegible-mono-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-atkinson-mono",
  display: "swap",
  preload: false,
});
