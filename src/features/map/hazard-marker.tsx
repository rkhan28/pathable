"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/misc";
import type { Hazard } from "@/api/contracts";
import { HazardDetails, useHazardLabel } from "@/features/hazards/hazard-details";
import { HazardBadgeIcon } from "@/features/hazards/hazard-visuals";
import { cn } from "@/lib/utils";

/**
 * A map marker that is a real button. Hazards on the selected route are in the
 * tab order; "nearby" hazards are not (they're listed in the panel instead) so
 * keyboard users aren't forced through dozens of stops.
 */
export function HazardMarker({ hazard, focusable }: { hazard: Hazard; focusable: boolean }) {
  const label = useHazardLabel()(hazard);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          tabIndex={focusable ? 0 : -1}
          className={cn(
            "grid size-11 place-items-center rounded-full transition-transform hover:scale-110 focus-visible:scale-110 data-[state=open]:scale-110",
            !focusable && "opacity-90",
          )}
        >
          <HazardBadgeIcon hazard={hazard} size={focusable ? "md" : "sm"} className="shadow-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80">
        <HazardDetails hazard={hazard} />
      </PopoverContent>
    </Popover>
  );
}
