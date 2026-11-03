"use client";

import { Slider as RSlider, Switch as RSwitch } from "radix-ui";
import { useId } from "react";

/** Labelled switch row; the whole row is the hit target. */
export function SwitchRow({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="pa-switch-row">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-sm text-ink-muted">{hint}</span>}
      </label>
      <RSwitch.Root id={id} checked={checked} onCheckedChange={onChange} className="pa-switch">
        <RSwitch.Thumb className="pa-switch-thumb" />
      </RSwitch.Root>
    </div>
  );
}

/** Labelled slider with the current value shown and announced in the same units. */
export function SliderRow({
  label,
  hint,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="pa-slider-row">
      <div className="flex items-baseline justify-between gap-4">
        <span id={id} className="font-bold">
          {label}
        </span>
        <output className="tabular text-md" aria-hidden>
          {format(value)}
        </output>
      </div>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      <RSlider.Root className="pa-slider" value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)}>
        <RSlider.Track className="pa-slider-track">
          <RSlider.Range className="pa-slider-range" />
        </RSlider.Track>
        <RSlider.Thumb className="pa-slider-thumb" aria-labelledby={id} aria-valuetext={format(value)} />
      </RSlider.Root>
    </div>
  );
}
