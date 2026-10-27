import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Adapted from Magic UI "Dot Pattern" (MIT, https://magicui.design).
 * The original renders one animated <motion.circle> per dot and listens to
 * resize; this version uses a single SVG <pattern>, so it costs one DOM node,
 * needs no JavaScript, and is static (no motion to reduce). Decorative only.
 */
export function DotPattern({ size = 18, radius = 1.2, className }: { size?: number; radius?: number; className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
