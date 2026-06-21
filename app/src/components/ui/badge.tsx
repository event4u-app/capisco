import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Capisco Badge — tiny monochrome label (model names, statuses, counts).
 * Keep `outline` (gray) almost everywhere; `accent` only to spotlight.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-1.5 h-4 text-[10.5px] font-medium leading-none whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        outline: "border-border bg-transparent text-muted-foreground",
        accent: "border-primary/40 bg-primary/10 text-primary",
        success: "border-success/40 bg-success/10 text-success",
        warning: "border-warning/40 bg-warning/10 text-warning",
        destructive: "border-destructive/40 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
