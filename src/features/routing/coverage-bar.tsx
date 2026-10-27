import type { Route, SegmentStatus } from "@/api/contracts";
import { cn } from "@/lib/utils";
import { SEGMENT_ORDER } from "./status-visuals";

const FILL: Record<SegmentStatus, string> = {
  verified_accessible: "bg-verified",
  // solid + light centre stripe, matching the map line
  known_barrier: "bg-barrier bg-[linear-gradient(transparent_42%,var(--surface-raised)_42%,var(--surface-raised)_58%,transparent_58%)]",
  reported_unverified: "bg-unverified-soft text-unverified pattern-hatch",
  unknown: "bg-unknown-soft text-unknown pattern-dots",
};

/**
 * Proportion of the route in each knowledge state. Decorative: the same
 * numbers are always present as text beside it.
 */
export function CoverageBar({ coverage, className }: { coverage: Route["summary"]["coverage"]; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex h-3 w-full gap-0.5 overflow-hidden rounded-full", className)}>
      {SEGMENT_ORDER.filter((s) => coverage[s] > 0.001).map((s) => (
        <span key={s} className={cn("h-full first:rounded-s-full last:rounded-e-full", FILL[s])} style={{ width: `${coverage[s] * 100}%` }} />
      ))}
    </div>
  );
}
