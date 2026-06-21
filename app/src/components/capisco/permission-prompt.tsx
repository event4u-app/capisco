"use client";

import * as React from "react";
import { KeyRound, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Capisco PermissionPrompt — the capability-broker approval block. This is the
 * product's signature element (build-spec §4 / Overview §2): teal-outlined,
 * calm (never alarmist). First scope is the emphasized action, last is the
 * deny/ghost.
 *
 * Invariants made visible (Overview §2.1):
 *  - `credentialRef` shows a secret as a *reference* (`credential: …`), never
 *    its value — secrets never enter the LLM context.
 *  - `prodNote` surfaces the read-only / per-command-only floor for production
 *    datasources; there is deliberately no "allow permanently" scope.
 */
export interface PermissionPromptProps extends React.HTMLAttributes<HTMLDivElement> {
  command: string;
  label?: string;
  scopes?: string[];
  /** Secret reference, shown verbatim (never the value). */
  credentialRef?: string;
  /** Localized note explaining the credential reference (no value shown). */
  credentialNote?: string;
  /** Localized read-only / per-command production note. */
  prodNote?: string;
  onGrant?: (scope: string) => void;
}

export function PermissionPrompt({
  command,
  label = "Approval required",
  scopes = ["Once", "This session", "Deny"],
  credentialRef,
  credentialNote,
  prodNote,
  onGrant,
  className,
  ...props
}: PermissionPromptProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid="permission-prompt"
      className={cn(
        "flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/10 p-2.5",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5">
        <Lock className="size-3.5 shrink-0 text-primary" />
        <code
          data-testid="permission-command"
          className="rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-code text-foreground"
        >
          {command}
        </code>
      </div>
      <div className="text-ui text-muted-foreground">{label}</div>
      {credentialRef && (
        <div className="flex flex-col gap-0.5" data-testid="permission-credential">
          <span className="inline-flex w-fit items-center gap-1 rounded-sm border border-border bg-muted px-1.5 py-0.5 font-mono text-code text-foreground">
            <KeyRound className="size-3 shrink-0 text-primary" />
            credential: {credentialRef}
          </span>
          {credentialNote && (
            <span className="text-micro text-muted-foreground">{credentialNote}</span>
          )}
        </div>
      )}
      {prodNote && (
        <div className="text-micro text-muted-foreground" data-testid="permission-prod-note">
          {prodNote}
        </div>
      )}
      <div className="flex gap-1.5">
        {scopes.map((s, i) => (
          <Button
            key={s}
            size="sm"
            data-testid={`permission-scope-${i}`}
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
