import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Capisco StatusDot — session / process state.
 * running pulses; waiting is half-filled teal (needs broker approval).
 */
const dotVariants = cva("inline-block rounded-full box-border shrink-0", {
  variants: {
    status: {
      running: "bg-success animate-capisco-pulse",
      idle: "border-[1.5px] border-muted-foreground",
      waiting:
        "border-[1.5px] border-primary [background:linear-gradient(90deg,hsl(var(--primary))_0_50%,transparent_50%)]",
      error: "bg-destructive",
      done: "bg-success",
    },
  },
  defaultVariants: { status: "idle" },
});

export interface StatusDotProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof dotVariants> {
  size?: number;
}

export function StatusDot({ status, size = 8, className, style, ...props }: StatusDotProps) {
  return (
    <span
      role="status"
      className={cn(dotVariants({ status }), className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  );
}
