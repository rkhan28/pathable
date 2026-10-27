"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  Accordion as AccordionPrimitive,
  Popover as PopoverPrimitive,
  Tabs as TabsPrimitive,
  Tooltip as TooltipPrimitive,
} from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/* Adapted from shadcn/ui (MIT): Tabs, Accordion, Tooltip, Popover. */

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex gap-1 rounded-full border border-border bg-bg-subtle p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[0.95rem] font-medium text-fg-muted transition-colors hover:text-fg",
        "data-[state=active]:bg-surface-raised data-[state=active]:font-semibold data-[state=active]:text-fg data-[state=active]:shadow-2 data-[state=active]:ring-1 data-[state=active]:ring-border-strong",
        "focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-focus [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none focus-visible:outline-3 focus-visible:outline-focus", className)} {...props} />;
}

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={cn("border-b border-border", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex min-h-14 flex-1 items-center justify-between gap-4 py-4 text-start text-[1.05rem] font-semibold transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-focus",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-fg-muted transition-transform duration-300 ease-out-soft group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pb-5 text-fg-muted leading-relaxed", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;

/** Tooltips only ever repeat information available elsewhere (aria-label / visible text). */
export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          className="z-50 max-w-xs rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-fg-inverse shadow-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-fg" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({ className, align = "center", sideOffset = 8, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-lg border border-border bg-surface-raised p-4 text-fg shadow-3 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-surface-sunken", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}
