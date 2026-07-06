"use client";

import * as React from "react";
import { KeyRound, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GrantPreview } from "@/contracts";

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
 *  - `grantPreview` (scoped-grant / bulk-run, item 229) is ADDITIVE + opt-in:
 *    when present (feature on) it renders a pattern-coverage preview + a single
 *    "grant N writes under `<prefix>/`" affordance instead of N per-write prompts.
 *    Absent (feature off) → the block is byte-identical to before, so goldens are
 *    unchanged. The covered/out-of-scope split mirrors the broker's `scopeMatches`
 *    rule, so it never over-promises what the grant will actually clear.
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
  /**
   * Scoped-grant bulk-run preview (item 229, feature-gated by the caller). When
   * provided, a scoped affordance renders; when omitted, the prompt is unchanged.
   */
  grantPreview?: GrantPreview;
  /** Localized heading for the scoped block, e.g. "Grant {n} writes under {prefix}". */
  scopedLabel?: string;
  /** Localized coverage line, e.g. "{covered} covered · {out} stay single-gated". */
  scopedCoverageLabel?: string;
  /** Fired when the human grants the scoped bulk write (pathPrefix + budget). */
  onGrantScoped?: (pathPrefix: string, maxActions: number) => void;
}

export function PermissionPrompt({
  command,
  label = "Approval required",
  scopes = ["Once", "This session", "Deny"],
  credentialRef,
  credentialNote,
  prodNote,
  onGrant,
  grantPreview,
  scopedLabel,
  scopedCoverageLabel,
  onGrantScoped,
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
      {grantPreview && (
        <div
          data-testid="permission-scoped"
          className="flex flex-col gap-1 rounded-sm border border-primary/30 bg-primary/5 p-1.5"
        >
          <div className="flex items-center gap-1 text-ui text-foreground">
            <span
              data-testid="permission-scoped-covered"
              className="inline-flex items-center gap-1 text-primary"
            >
              ✓ {grantPreview.covered.length}
            </span>
            <span className="text-muted-foreground">
              {scopedCoverageLabel ?? `covered under ${grantPreview.pathPrefix}`}
            </span>
            {grantPreview.outOfScope.length > 0 && (
              <span
                data-testid="permission-scoped-outofscope"
                className="text-muted-foreground"
              >
                · ⚠ {grantPreview.outOfScope.length} stay single-gated
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            data-testid="permission-scoped-grant"
            className="w-fit"
            disabled={grantPreview.covered.length === 0}
            onClick={() => onGrantScoped?.(grantPreview.pathPrefix, grantPreview.maxActions)}
          >
            {scopedLabel ??
              `Grant ${grantPreview.maxActions} writes under ${grantPreview.pathPrefix}`}
          </Button>
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
