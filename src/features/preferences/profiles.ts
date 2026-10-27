import {
  Accessibility,
  Baby,
  Footprints,
  Settings2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { MobilityPreferences, MobilityProfileId } from "@/api/contracts";
import { ScooterIcon, WalkerIcon, CaneIcon } from "./profile-icons";

/**
 * Starting points only. Every value is editable and nothing here assumes what
 * a person can or can't do — the onboarding copy says so explicitly.
 *
 * Slope references: Ontario's AODA Design of Public Spaces standard limits
 * exterior paths of travel to a 1:20 (5%) running slope before a ramp is
 * required, and ramps to 1:15 (≈6.7%). We use those as conservative defaults
 * for wheeled devices and relax them where people commonly do.
 */
export const PROFILE_DEFAULTS: Record<MobilityProfileId, Omit<MobilityPreferences, "profile">> = {
  manual_wheelchair: {
    maxSlopePercent: 5,
    minWidthCm: 92,
    avoidStairs: true,
    avoidSteepCurbs: true,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: true,
    avoidNarrowPassages: true,
    preferVerifiedRoutes: true,
    preferShorterRoutes: false,
  },
  powered_wheelchair: {
    maxSlopePercent: 8,
    minWidthCm: 92,
    avoidStairs: true,
    avoidSteepCurbs: true,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: true,
    avoidNarrowPassages: true,
    preferVerifiedRoutes: true,
    preferShorterRoutes: false,
  },
  mobility_scooter: {
    maxSlopePercent: 8,
    minWidthCm: 100,
    avoidStairs: true,
    avoidSteepCurbs: true,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: true,
    avoidNarrowPassages: true,
    preferVerifiedRoutes: true,
    preferShorterRoutes: false,
  },
  walker: {
    maxSlopePercent: 6,
    minWidthCm: null,
    avoidStairs: true,
    avoidSteepCurbs: true,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: true,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: true,
    preferShorterRoutes: true,
  },
  cane: {
    maxSlopePercent: 8,
    minWidthCm: null,
    avoidStairs: false,
    avoidSteepCurbs: false,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: false,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: false,
    preferShorterRoutes: true,
  },
  reduced_mobility: {
    maxSlopePercent: 6,
    minWidthCm: null,
    avoidStairs: true,
    avoidSteepCurbs: false,
    avoidDamagedSurfaces: true,
    avoidReportedObstacles: false,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: false,
    preferShorterRoutes: true,
  },
  stroller: {
    maxSlopePercent: 8,
    minWidthCm: 70,
    avoidStairs: true,
    avoidSteepCurbs: true,
    avoidDamagedSurfaces: false,
    avoidReportedObstacles: false,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: false,
    preferShorterRoutes: true,
  },
  custom: {
    maxSlopePercent: null,
    minWidthCm: null,
    avoidStairs: false,
    avoidSteepCurbs: false,
    avoidDamagedSurfaces: false,
    avoidReportedObstacles: false,
    avoidNarrowPassages: false,
    preferVerifiedRoutes: true,
    preferShorterRoutes: false,
  },
};

export const PROFILE_ICONS: Record<MobilityProfileId, LucideIcon | typeof ScooterIcon> = {
  manual_wheelchair: Accessibility,
  powered_wheelchair: Zap,
  mobility_scooter: ScooterIcon,
  walker: WalkerIcon,
  cane: CaneIcon,
  reduced_mobility: Footprints,
  stroller: Baby,
  custom: Settings2,
};

export const DEFAULT_PREFERENCES: MobilityPreferences = { profile: "custom", ...PROFILE_DEFAULTS.custom };

export function preferencesForProfile(profile: MobilityProfileId): MobilityPreferences {
  return { profile, ...PROFILE_DEFAULTS[profile] };
}

