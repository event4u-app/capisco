import * as React from "react";
import { useTranslation } from "react-i18next";
import { Gauge, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { budgetTone, formatTokens, type BudgetTone } from "./store";

/** Tone → token-driven colour classes (no raw hex; design tokens only). */
const TONE_META: Record<BudgetTone, { text: string; bg: string; bar: string }> = {
  ok: { text: "text-success", bg: "bg-success", bar: "[&>span]:bg-success" },
  warn: { text: "text-warning", bg: "bg-warning", bar: "[&>span]:bg-warning" },
  crit: { text: "text-destructive", bg: "bg-destructive", bar: "[&>span]:bg-destructive" },
};

const PRESETS = [100_000, 150_000, 200_000, 300_000];

/**
 * Context-budget meter (Design-Sync P4) — the LEFT control of the composer bar.
 * Shows `used/budget` with a colour bar that flips green → orange → red against
 * the threshold, and a click-popover with a slider + presets that moves the
 * warn line live. PURE PROJECTION: it reads the session's already-reported
 * tokens (`used`) and a store threshold (`budget`); it wires no behaviour. The
 * `crit` tone is the SAME band that raises the Rot-banner over the input.
 */
export function ContextBudgetMeter({
  used,
  budget,
  setBudget,
}: {
  used: number;
  budget: number;
  setBudget: (n: number) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const tone = budgetTone(used, budget);
  const meta = TONE_META[tone];
  const ratio = budget > 0 ? used / budget : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const Glyph = tone === "crit" ? TriangleAlert : Gauge;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="context-meter"
          data-tone={tone}
          aria-label={t("agents.composer.contextMeter")}
          title={t("agents.composer.contextMeter")}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-sm px-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            open && "bg-accent",
          )}
        >
          <Glyph className={cn("size-3.5", meta.text)} strokeWidth={1.8} aria-hidden />
          <span
            data-testid="context-meter-value"
            className={cn("font-mono text-[10.5px]", meta.text)}
          >
            {formatTokens(used)}/{formatTokens(budget)}
          </span>
          <span
            aria-hidden
            data-testid="context-meter-bar"
            className="relative h-1 w-9 overflow-hidden rounded-full bg-muted"
          >
            <span
              className={cn("absolute inset-y-0 left-0 rounded-full", meta.bg)}
              style={{ width: `${pct}%` }}
            />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-72 p-3.5"
        data-testid="context-meter-pop"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("agents.composer.contextBudget")}
          </span>
          <span className={cn("font-mono text-ui", meta.text)} data-testid="context-meter-pct">
            {pct}%
          </span>
        </div>
        <div className="mb-3 text-ui text-muted-foreground">
          {t("agents.composer.contextWarnAt", {
            budget: formatTokens(budget),
            used: formatTokens(used),
          })}
        </div>
        <Slider
          data-testid="context-budget-slider"
          aria-label={t("agents.composer.contextBudget")}
          min={50_000}
          max={400_000}
          step={10_000}
          value={[budget]}
          onValueChange={(v) => setBudget(v[0])}
          // DS slider (design-sync-v2 §1): teal-filled track (shared Slider
          // default) + SQUARE thumb (3px corner, DS control radius) — per-instance
          // override so the shared round-thumb Slider stays untouched elsewhere.
          className={cn(meta.bar, "[&_[role=slider]]:rounded-sm")}
        />
        <div className="mt-3 flex gap-1.5">
          {PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={budget === v}
              data-testid={`context-budget-preset-${v}`}
              onClick={() => setBudget(v)}
              className={cn(
                "h-6 flex-1 rounded-sm border text-ui focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                budget === v
                  ? "border-primary/60 bg-primary/10 font-medium text-primary"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {formatTokens(v)}
            </button>
          ))}
        </div>
        <div className="mt-2.5 text-micro text-muted-foreground">
          {t("agents.composer.contextNote")}
        </div>
      </PopoverContent>
    </Popover>
  );
}
