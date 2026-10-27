import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger" | "neutral" | "winter";

const toneStyles: Record<Tone, { box: string; icon: LucideIcon }> = {
  info: { box: "border-info/40 bg-info-soft text-fg [--tone:var(--info)]", icon: InfoIcon },
  success: { box: "border-verified/40 bg-verified-soft text-fg [--tone:var(--verified)]", icon: CircleCheckIcon },
  warning: { box: "border-unverified/45 bg-unverified-soft text-fg [--tone:var(--unverified)]", icon: TriangleAlertIcon },
  danger: { box: "border-barrier/45 bg-barrier-soft text-fg [--tone:var(--barrier)]", icon: CircleAlertIcon },
  neutral: { box: "border-border bg-bg-subtle text-fg [--tone:var(--fg-muted)]", icon: InfoIcon },
  winter: { box: "border-winter/40 bg-winter-soft text-fg [--tone:var(--winter)]", icon: InfoIcon },
};

/** Inline message. Tone is always reinforced by an icon and (usually) a title. */
export function Callout({
  tone = "info",
  title,
  children,
  icon,
  action,
  className,
  role,
}: {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  role?: "status" | "alert" | "note";
}) {
  const Icon = icon ?? toneStyles[tone].icon;
  return (
    <div role={role} className={cn("flex gap-3 rounded-lg border p-4", toneStyles[tone].box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0 text-[var(--tone)]" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="font-semibold leading-snug">{title}</p> : null}
        {children ? <div className="text-[0.95rem] leading-relaxed text-fg-muted">{children}</div> : null}
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Badge({ className, tone = "neutral", children }: { className?: string; tone?: Tone; children: React.ReactNode }) {
  const styles: Record<Tone, string> = {
    info: "bg-info-soft text-info border-info/30",
    success: "bg-verified-soft text-verified border-verified/30",
    warning: "bg-unverified-soft text-unverified border-unverified/35",
    danger: "bg-barrier-soft text-barrier border-barrier/35",
    neutral: "bg-bg-subtle text-fg-muted border-border",
    winter: "bg-winter-soft text-winter border-winter/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5", styles[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, children, action, className }: { icon: LucideIcon; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <span className="grid size-14 place-items-center rounded-full bg-bg-subtle text-fg-muted">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="max-w-sm text-fg-muted">{children}</div> : null}
      {action}
    </div>
  );
}

/** Determinate progress with an accessible name and text value. */
export function ProgressBar({ value, label, valueText, className }: { value: number; label: string; valueText?: string; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out-soft" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
