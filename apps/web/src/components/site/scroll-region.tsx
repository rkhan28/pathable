"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A wide table's sideways-scrolling wrapper. When its content is wider than
 * the screen it joins the tab order, so a keyboard user can focus it and
 * scroll with the arrow keys; when everything fits it is not a tab stop at all.
 * The tab stop is set where the overflow is measured, as the size changes.
 */
export function ScrollRegion({ labelledBy, className, children }: { labelledBy: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
      else el.removeAttribute("tabindex");
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`pa-table-scroll ${className ?? ""}`} role="region" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}
