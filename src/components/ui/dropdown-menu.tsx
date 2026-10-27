"use client";

import { CheckIcon } from "lucide-react";
import { DropdownMenu as Primitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Adapted from shadcn/ui DropdownMenu (MIT). Radix provides roving focus, typeahead and Escape handling. */
export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;
export const DropdownMenuRadioGroup = Primitive.RadioGroup;
export const DropdownMenuGroup = Primitive.Group;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 overflow-hidden rounded-lg border border-border bg-surface-raised p-1.5 text-fg shadow-3",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

const itemBase =
  "relative flex min-h-11 cursor-default select-none items-center gap-3 rounded-md px-3 text-[0.95rem] outline-none data-[highlighted]:bg-bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className={cn(itemBase, className)} {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof Primitive.RadioItem>) {
  return (
    <Primitive.RadioItem className={cn(itemBase, "ps-9 data-[state=checked]:font-semibold", className)} {...props}>
      <span className="absolute start-3 grid size-4 place-items-center">
        <Primitive.ItemIndicator>
          <CheckIcon className="text-accent" strokeWidth={3} />
        </Primitive.ItemIndicator>
      </span>
      {children}
    </Primitive.RadioItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("px-3 pt-2 pb-1 text-sm font-semibold text-fg-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}
