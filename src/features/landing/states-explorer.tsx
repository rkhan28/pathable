"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { SegmentStatus } from "@/api/contracts";
import { SEGMENT_ORDER, SEGMENT_STYLE, SegmentSwatch, StatusIcon } from "@/features/routing/status-visuals";
import { cn } from "@/lib/utils";

const KEYS: Record<SegmentStatus, "verified" | "barrier" | "reported" | "unknown"> = {
  verified_accessible: "verified",
  known_barrier: "barrier",
  reported_unverified: "reported",
  unknown: "unknown",
};

/** A route drawn as four sections. Pick a state to isolate its section. */
const SECTIONS: { status: SegmentStatus; d: string }[] = [
  { status: "verified_accessible", d: "M30 150 C 90 150 110 70 190 70" },
  { status: "unknown", d: "M190 70 C 250 70 270 140 330 140" },
  { status: "reported_unverified", d: "M330 140 C 390 140 400 60 470 60" },
  { status: "known_barrier", d: "M470 60 C 530 60 540 120 590 120" },
];

export function StatesExplorer() {
  const t = useTranslations("landing.states");
  const [active, setActive] = useState<SegmentStatus | null>(null);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
      <div>
        <p className="mb-4 text-sm text-fg-muted">{t("explore")}</p>
        <ul className="flex flex-col gap-2">
          {SEGMENT_ORDER.map((status) => {
            const key = KEYS[status];
            const pressed = active === status;
            return (
              <li key={status}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setActive(pressed ? null : status)}
                  className={cn(
                    "flex w-full items-start gap-4 rounded-lg border-2 p-4 text-start transition-colors",
                    pressed ? "border-fg bg-surface-raised shadow-2" : "border-transparent hover:bg-surface-raised/70",
                  )}
                >
                  <span className="mt-1 flex flex-col items-center gap-2">
                    <StatusIcon status={status} className="size-5" />
                    <SegmentSwatch status={status} width={34} />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">{t(`${key}.title`)}</span>
                    <span className="mt-1 block text-fg-muted">{t(`${key}.body`)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-[2rem] border border-border bg-surface p-4 shadow-2 sm:p-8" aria-hidden="true">
        <svg viewBox="0 0 620 210" className="h-auto w-full">
          {SECTIONS.map(({ status, d }) => {
            const s = SEGMENT_STYLE[status];
            const dim = active !== null && active !== status;
            const w = active === status ? 16 : 12;
            return (
              <g key={status} style={{ opacity: dim ? 0.18 : 1, transition: "opacity 300ms" }}>
                <path d={d} fill="none" stroke="var(--surface-raised)" strokeWidth={w + 8} strokeLinecap="round" />
                <path
                  d={d}
                  fill="none"
                  stroke={`var(${s.cssVar})`}
                  strokeWidth={w}
                  strokeLinecap="round"
                  strokeDasharray={s.dash ? s.dash.map((x) => x * w).join(" ") : undefined}
                  style={{ transition: "stroke-width 300ms" }}
                />
                {status === "known_barrier" ? <path d={d} fill="none" stroke="var(--surface-raised)" strokeWidth={w / 4} strokeLinecap="round" /> : null}
              </g>
            );
          })}
          <circle cx={30} cy={150} r={11} fill="var(--surface-raised)" stroke="var(--fg)" strokeWidth={5} />
          <circle cx={590} cy={120} r={12} fill="var(--accent)" stroke="var(--surface-raised)" strokeWidth={4} />
          <g transform="translate(530 88)" style={{ opacity: active && active !== "known_barrier" ? 0.18 : 1, transition: "opacity 300ms" }}>
            <circle r={14} fill="var(--barrier)" stroke="var(--surface-raised)" strokeWidth={3} />
            <path d="M-6 5h4v-4h4v-4h4" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {SEGMENT_ORDER.map((status) => (
            <span key={status} className={cn("flex items-center gap-2 transition-opacity", active && active !== status && "opacity-40")}>
              <SegmentSwatch status={status} width={30} />
              {t(`${KEYS[status]}.title`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
