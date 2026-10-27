import { CircleCheckIcon, CircleHelpIcon, OctagonXIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";
import type { SegmentStatus } from "@/api/contracts";
import { cn } from "@/lib/utils";

/**
 * Barriers are drawn as a solid line with a light centre stripe.
 * One visual language for sidewalk knowledge, shared by the map, route cards,
 * legends and the landing page. Each state differs in THREE ways — colour,
 * line pattern and icon — so none depends on colour perception (WCAG 1.4.1).
 */
export const SEGMENT_STYLE: Record<SegmentStatus, { cssVar: string; dash: number[] | null; icon: LucideIcon; textClass: string; softClass: string }> = {
  verified_accessible: { cssVar: "--verified", dash: null, icon: CircleCheckIcon, textClass: "text-verified", softClass: "bg-verified-soft" },
  known_barrier: { cssVar: "--barrier", dash: null, icon: OctagonXIcon, textClass: "text-barrier", softClass: "bg-barrier-soft" },
  reported_unverified: { cssVar: "--unverified", dash: [2.4, 1.6], icon: TriangleAlertIcon, textClass: "text-unverified", softClass: "bg-unverified-soft" },
  unknown: { cssVar: "--unknown", dash: [0.1, 1.8], icon: CircleHelpIcon, textClass: "text-unknown", softClass: "bg-unknown-soft" },
};

export const SEGMENT_ORDER: SegmentStatus[] = ["verified_accessible", "known_barrier", "reported_unverified", "unknown"];

/** A short line sample in the exact pattern used on the map. */
export function SegmentSwatch({ status, className, width = 40 }: { status: SegmentStatus; className?: string; width?: number }) {
  const s = SEGMENT_STYLE[status];
  const sw = 6;
  return (
    <svg width={width} height={14} viewBox={`0 0 ${width} 14`} aria-hidden="true" className={cn("shrink-0", className)}>
      <line
        x1={4}
        y1={7}
        x2={width - 4}
        y2={7}
        stroke={`var(${s.cssVar})`}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={s.dash ? s.dash.map((d) => d * sw).join(" ") : undefined}
      />
      {status === "known_barrier" ? (
        // Barriers carry a centre stripe ("railway" line) so they differ from verified lines without colour.
        <line x1={4} y1={7} x2={width - 4} y2={7} stroke="var(--surface-raised)" strokeWidth={1.8} strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export function StatusIcon({ status, className }: { status: SegmentStatus; className?: string }) {
  const { icon: Icon, textClass } = SEGMENT_STYLE[status];
  return <Icon aria-hidden="true" className={cn("size-4 shrink-0", textClass, className)} />;
}
