"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MOBILITY_PROFILE_IDS, type MobilityProfileId } from "@/api/contracts";
import { cn } from "@/lib/utils";
import { PROFILE_ICONS } from "./profiles";

/** Native radio group styled as cards — arrow keys, form semantics and screen readers work for free. */
export function ProfilePicker({ value, onChange, legend, hint, columns = 2, hideLegend = false }: { value: MobilityProfileId; onChange: (id: MobilityProfileId) => void; legend: string; hint?: string; columns?: 2 | 4; hideLegend?: boolean }) {
  const t = useTranslations("profiles");
  return (
    <fieldset>
      <legend className={cn("text-[0.95rem] font-semibold", hideLegend && "sr-only")}>{legend}</legend>
      {hint ? <p className="mt-1 text-sm text-fg-muted">{hint}</p> : null}
      <div className={cn("mt-3 grid gap-2.5", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
        {MOBILITY_PROFILE_IDS.map((id) => {
          const Icon = PROFILE_ICONS[id];
          const checked = value === id;
          return (
            <label
              key={id}
              className={cn(
                "relative flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border-2 bg-surface-raised p-3 transition-colors",
                "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                checked ? "border-fg shadow-2" : "border-border hover:border-border-strong",
                columns === 4 && "flex-col items-start",
              )}
            >
              <input type="radio" name="mobility-profile" value={id} checked={checked} onChange={() => onChange(id)} className="sr-only" />
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", checked ? "bg-primary text-primary-fg" : "bg-mint text-forest dark:text-accent")}>
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-semibold leading-snug">{t(`${id}.name`)}</span>
              {checked ? <CheckIcon className="absolute end-3 top-3 size-4 text-fg" strokeWidth={3} aria-hidden="true" /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
