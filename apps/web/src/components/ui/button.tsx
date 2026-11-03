"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  // Signal emerald: the one key action on a screen. Ink label: white on emerald is only 3.3:1.
  primary: "bg-signal text-on-signal hover:brightness-95 active:brightness-90",
  secondary: "bg-surface-raised text-ink border border-line hover:bg-surface-sunken",
  quiet: "bg-transparent text-ink hover:bg-surface-sunken",
  danger: "bg-barrier text-surface-raised hover:brightness-95",
};
const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-md",
  icon: "size-11 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, loadingLabel, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "pa-press inline-flex items-center gap-2 rounded-control font-bold transition-[filter,background-color,transform] duration-(--duration-press)",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 aria-hidden size={18} className="animate-spin motion-reduce:animate-none" />}
      {loading && loadingLabel ? <span>{loadingLabel}</span> : children}
    </button>
  );
});
