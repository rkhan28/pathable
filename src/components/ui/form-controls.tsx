"use client";

import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive, Label as LabelPrimitive, Slider as SliderPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* Adapted from shadcn/ui (MIT): Label, Input, Textarea, Switch, Checkbox, Slider. */

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn("text-[0.95rem] font-semibold text-fg", className)} {...props} />;
}

const fieldBase =
  "w-full rounded-md border-2 border-input bg-surface-raised px-4 text-base text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 hover:border-fg-muted focus-visible:border-focus focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-halo)] aria-invalid:border-barrier disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(fieldBase, "min-h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        // 44px hit area with a visually smaller track
        "group relative inline-flex h-11 w-[3.6rem] shrink-0 cursor-pointer items-center rounded-full outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 rounded-full border-2 border-border-strong bg-surface-sunken transition-colors group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent"
      />
      <SwitchPrimitive.Thumb className="relative z-10 ms-1 grid size-5 place-items-center rounded-full bg-surface-raised shadow-2 transition-transform duration-200 ease-out-soft data-[state=checked]:translate-x-[1.6rem] rtl:data-[state=checked]:-translate-x-[1.6rem]">
        <CheckIcon className="size-3 text-accent opacity-0 transition-opacity group-data-[state=checked]:opacity-100" strokeWidth={3} />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer grid size-6 shrink-0 place-items-center rounded-[6px] border-2 border-border-strong bg-surface-raised transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <CheckIcon className="size-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function Slider({ className, thumbLabel, ...props }: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabel: string }) {
  return (
    <SliderPrimitive.Root className={cn("relative flex h-11 w-full touch-none items-center select-none", className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-surface-sunken">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        className="block size-7 rounded-full border-[3px] border-accent bg-surface-raised shadow-2 transition-transform hover:scale-105 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
    </SliderPrimitive.Root>
  );
}

/** Label + control + hint + error, wired with ids for assistive tech. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean }>;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {hint ? (
        <p id={hintId} className="-mt-1 text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
      {React.cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-sm font-semibold text-barrier">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
