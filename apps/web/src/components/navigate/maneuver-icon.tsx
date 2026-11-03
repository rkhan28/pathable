import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Bus,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Footprints,
  LogOut,
  Navigation2,
  TrainFront,
  TramFront,
  type LucideIcon,
} from "lucide-react";
import type { Maneuver, TransitMode } from "@/lib/api/contracts";
import type { JourneyStep } from "@/lib/journey";

const MANEUVER: Record<Maneuver, LucideIcon> = {
  depart: Navigation2,
  continue: ArrowUp,
  turn_left: CornerUpLeft,
  turn_right: CornerUpRight,
  slight_left: ArrowUpLeft,
  slight_right: ArrowUpRight,
  cross: Footprints,
  arrive: Flag,
};

export const MODE_ICON: Record<TransitMode, LucideIcon> = {
  bus: Bus,
  streetcar: TramFront,
  lrt: TramFront,
  subway: TrainFront,
  rail: TrainFront,
};

export function StepIcon({ step, size = 32 }: { step: JourneyStep; size?: number }) {
  if (step.kind === "board") {
    const Icon = MODE_ICON[step.ride.mode];
    return <Icon aria-hidden size={size} />;
  }
  if (step.kind === "alight") return <LogOut aria-hidden size={size} className="rtl:rotate-180" />;
  const Icon = MANEUVER[step.step.maneuver];
  // Left and right arrows mirror in right-to-left languages.
  const mirror = step.step.maneuver.includes("left") || step.step.maneuver.includes("right");
  return <Icon aria-hidden size={size} className={mirror ? "rtl:-scale-x-100" : undefined} />;
}

/** Black or white text, whichever reads better on a transit line's own colour. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? "#000000" : "#ffffff";
}
