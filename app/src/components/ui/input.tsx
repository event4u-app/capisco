import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Capisco Input — sunken field (search, terminal command, composer, settings).
 * Border goes teal (ring) on focus. Add `font-mono text-code` for command fields.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-7 w-full rounded-sm border border-input bg-muted px-2 py-1 text-ui text-foreground transition-colors",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-ui file:font-medium",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
