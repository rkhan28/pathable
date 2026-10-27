import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Adapted from shadcn/ui (MIT). Changes: PathAble tokens, 44px default touch
 * target (WCAG 2.5.8 recommends 24px minimum; we go further for motor access),
 * a visible focus outline that does not rely on colour, and a loading state
 * that keeps the label for screen readers.
 */
export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-full text-center font-semibold leading-tight",
    "transition-[background-color,color,box-shadow,transform] duration-200 ease-out-soft",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
    "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55",
    "active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.15em]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-2 hover:bg-primary-hover",
        accent: "bg-accent text-accent-fg shadow-2 hover:brightness-110",
        secondary: "bg-surface-raised text-fg border border-border shadow-1 hover:border-border-strong hover:bg-surface",
        outline: "border-2 border-fg/80 text-fg hover:bg-fg/5",
        ghost: "text-fg hover:bg-fg/6",
        subtle: "bg-bg-subtle text-fg hover:bg-surface-sunken",
        danger: "bg-barrier text-white shadow-2 hover:brightness-110 dark:text-[#1a0806]",
        link: "rounded-sm px-0 text-accent underline underline-offset-4 decoration-2 hover:decoration-[3px]",
      },
      size: {
        sm: "min-h-9 px-3.5 text-sm",
        md: "min-h-11 px-5 text-[0.95rem]",
        lg: "min-h-13 px-7 text-base",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-13",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingLabel?: string;
}

export function Button({ className, variant, size, asChild = false, loading = false, loadingLabel, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
            <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          </span>
          <span className="invisible">{children}</span>
          {loadingLabel ? <span className="sr-only">{loadingLabel}</span> : null}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}
