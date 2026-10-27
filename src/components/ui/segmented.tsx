"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Segmented control built on Radix ToggleGroup (single). Arrow keys move
 * between options (roving tabindex); selection is shown with fill + weight,
 * not colour alone.
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn("inline-flex flex-wrap gap-1 rounded-full border border-border bg-bg-subtle p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroupPrimitive.Item
          key={o.value}
          value={o.value}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 font-medium text-fg-muted transition-[background-color,color,box-shadow] duration-200",
            size === "md" ? "min-h-10 text-[0.95rem]" : "min-h-9 text-sm",
            "hover:text-fg data-[state=on]:bg-surface-raised data-[state=on]:font-semibold data-[state=on]:text-fg data-[state=on]:shadow-2 data-[state=on]:ring-1 data-[state=on]:ring-border-strong",
            "focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus [&_svg]:size-4",
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
