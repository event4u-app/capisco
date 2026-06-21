"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Capisco PermissionPrompt — the capability-broker approval block.
 * Teal-outlined, calm (never alarmist). First scope is the emphasized action,
 * last is the deny/ghost.
 */
export interface PermissionPromptProps extends React.HTMLAttributes<HTMLDivElement> {
  command: string;
  label?: string;
  scopes?: string[];
  onGrant?: (scope: string) => void;
}

export function PermissionPrompt({
  command,
  label = "Approval required",
  scopes = ["Once", "This session", "Deny"],
  onGrant,
  className,
  ...props
}: PermissionPromptProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/10 p-2.5",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        <Lock className="size-3.5 shrink-0 text-primary" />
        <code className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-code text-foreground">
          {command}
        </code>
      </div>
      <div className="text-ui text-muted-foreground">{label}</div>
      <div className="flex gap-1.5">
        {scopes.map((s, i) => (
          <Button
            key={s}
            size="sm"
            variant={i === 0 ? "default" : i === scopes.length - 1 ? "ghost" : "outline"}
            onClick={() => onGrant?.(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}
