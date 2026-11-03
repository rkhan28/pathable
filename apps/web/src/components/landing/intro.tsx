"use client";

import { useEffect } from "react";

const KEY = "pathable:intro";
/** Matches the length of the CSS intro in components.css (draw, then lift). */
const INTRO_MS = 1500;

/**
 * The landing's opening moment: the mark draws itself (origin ring, the P,
 * then the destination dot) and lifts away. CSS does the drawing so it starts
 * before any JavaScript; this script and component only make sure it plays
 * once per browser session and never under reduced motion.
 *
 * The overlay never takes pointer events, and the headline is painted beneath
 * it from the start, so it neither blocks a quick click nor delays the page's
 * largest paint.
 */
export const introScript = `try{var d=document.documentElement;if(sessionStorage.getItem("${KEY}"))d.dataset.intro="seen";else d.dataset.intro="play"}catch(e){document.documentElement.dataset.intro="seen"}`;

export function IntroMark() {
  useEffect(() => {
    const root = document.documentElement;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    if (root.dataset.intro === "seen") return;
    // Arriving by a link inside the site (no inline script ran): play it now, then mark it seen.
    root.dataset.intro = "play";
    const timer = window.setTimeout(() => (root.dataset.intro = "seen"), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="pa-intro" aria-hidden>
      <svg viewBox="0 0 32 32" className="pa-intro-mark">
        <circle className="pa-intro-ring" cx="10" cy="26.2" r="2.9" pathLength={1} />
        <path className="pa-intro-p" d="M10 22.6V11a7 7 0 0 1 7-7a7 7 0 0 1 0 14h-2.4" pathLength={1} />
        <circle className="pa-intro-dot" cx="13.4" cy="18" r="3.1" />
      </svg>
    </div>
  );
}
