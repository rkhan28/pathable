import {
  BanIcon,
  ConstructionIcon,
  DropletsIcon,
  MountainIcon,
  MoveHorizontalIcon,
  SnowflakeIcon,
  TrafficConeIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import type { Hazard, HazardType } from "@/api/contracts";
import { CurbRampIcon, SnowPathIcon } from "@/features/preferences/profile-icons";
import { cn } from "@/lib/utils";

function StairsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 20h5v-5h5v-5h5V5h3" />
    </svg>
  );
}

function BlockedRampIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 17h5l8-6h5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export const HAZARD_ICON: Record<HazardType, LucideIcon | ((p: React.SVGProps<SVGSVGElement>) => React.ReactElement)> = {
  stairs: StairsIcon,
  missing_curb_ramp: BlockedRampIcon,
  blocked_curb_ramp: CurbRampIcon,
  steep_slope: MountainIcon,
  damaged_surface: TriangleAlertIcon,
  narrow_passage: MoveHorizontalIcon,
  construction: ConstructionIcon,
  obstruction: TrafficConeIcon,
  snow_blocked: SnowPathIcon,
  ice: SnowflakeIcon,
  flooding: DropletsIcon,
  other: BanIcon,
};

export const isWinterHazard = (type: HazardType) => type === "snow_blocked" || type === "ice";

/**
 * Marker shape encodes status independent of colour:
 *  verified → filled circle, reported → hollow diamond, winter → hexagon tint.
 */
export function HazardBadgeIcon({ hazard, size = "md", className }: { hazard: Pick<Hazard, "type" | "status" | "severity">; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = HAZARD_ICON[hazard.type];
  const winter = isWinterHazard(hazard.type);
  const verified = hazard.status === "verified";
  const dims = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";
  const iconSize = size === "sm" ? "size-3.5" : size === "lg" ? "size-5.5" : "size-4.5";
  const tone = winter ? "winter" : hazard.status === "reported" ? "unverified" : "barrier";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid shrink-0 place-items-center",
        dims,
        verified ? "rounded-full" : "rotate-45 rounded-[6px]",
        verified && tone === "barrier" && "bg-barrier text-white dark:text-[#1a0806]",
        verified && tone === "winter" && "bg-winter text-white dark:text-[#06121c]",
        !verified && tone === "unverified" && "border-2 border-dashed border-unverified bg-unverified-soft text-unverified",
        !verified && tone === "winter" && "border-2 border-dashed border-winter bg-winter-soft text-winter",
        !verified && tone === "barrier" && "border-2 border-dashed border-barrier bg-barrier-soft text-barrier",
        className,
      )}
    >
      <Icon className={cn(iconSize, !verified && "-rotate-45")} strokeWidth={2.2} />
    </span>
  );
}
