"use client";

import { useEffect, useState, type ReactNode } from "react";

// Set after the first page has hydrated. Never set on the server, where effects do not run.
let hydrated = false;

/**
 * A template remounts on every navigation, so each page after the first fades
 * in instead of snapping into place. The first page does not animate: its
 * headline should paint at once.
 */
export default function SiteTemplate({ children }: { children: ReactNode }) {
  const [enter] = useState(() => hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  return <div className={enter ? "pa-page is-entering" : "pa-page"}>{children}</div>;
}
