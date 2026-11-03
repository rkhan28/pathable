"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Native radio inputs in a fieldset: arrow keys move between options for free. */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
  className,
  hideLegend = false,
}: {
  legend: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className={cn("pa-segmented", className)}>
      <legend className={hideLegend ? "sr-only" : "pa-segmented-legend"}>{legend}</legend>
      <div className="pa-segmented-track">
        {options.map((o) => (
          <label key={o.value} className="pa-segmented-option">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="pa-segmented-input"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
