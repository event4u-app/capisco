import * as React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ChevronDown, CircleHelp, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { agentSnapshot } from "@/mocks";

const TONE_CLASS: Record<string, string> = {
  accent: "[&>div]:bg-primary",
  warning: "[&>div]:bg-warning",
  tertiary: "[&>div]:bg-muted-foreground",
};

/**
 * Composer controls (model picker · effort/plan-usage tune) — reused by the
 * design-sync-v2 {@link Composer} layout. The standalone `ComposerBar` wrapper
 * was retired in the composer graft; these two controls now mount inside the
 * unified composer's control row.
 */

/** Model picker — choose the model behind the active session. */
export function ModelControl({ model, setModel }: { model: string; setModel: (m: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const agents = agentSnapshot.agents;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="composer-model"
          aria-label={t("agents.composer.model")}
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-ui text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            open && "bg-accent text-foreground",
          )}
        >
          {model}
          <ChevronDown className="size-3" strokeWidth={1.6} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" sideOffset={8} className="w-44 p-1">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            data-testid={`composer-model-opt-${a.id}`}
            onClick={() => {
              setModel(a.label);
              setOpen(false);
            }}
            className={cn(
              "flex h-6 w-full items-center justify-between rounded-sm px-2 text-left text-ui hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              a.label === model ? "text-primary" : "text-foreground",
            )}
          >
            {a.label}
            {a.label === model && <Check className="size-3 text-primary" strokeWidth={2} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Tune control — a single "sliders" button that opens one popover combining the
 * reasoning-effort slider (Faster ↔ Smarter, 6 discrete steps) and the
 * plan-usage rows. Replaces the separate effort pill + budget ring (prototype
 * `design-update-v1`): the composer bar stays lean, the token-economy toggles
 * (Caveman terse mode, auto model routing) live in Agent settings.
 */
export function TuneControl({ effort, setEffort }: { effort: number; setEffort: (n: number) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const levels = agentSnapshot.effortLevels;
  const current = levels[effort] ?? levels[0];
  const plan = agentSnapshot.planUsage;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="composer-tune"
          aria-label={t("agents.composer.tune")}
          className={cn(
            "inline-flex h-6 items-center justify-center rounded-sm px-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            open && "bg-accent text-foreground",
          )}
        >
          <SlidersHorizontal className="size-3.5" strokeWidth={1.6} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="w-[300px] p-3.5"
        data-testid="composer-tune-pop"
      >
        {/* Effort section */}
        <div>
          <div className="mb-3.5 flex items-center justify-between">
            <span className="text-ui text-muted-foreground">
              {t("agents.composer.effort")} <b className="ml-1 text-foreground">{current.label}</b>
            </span>
            <CircleHelp
              className="size-3.5 text-muted-foreground"
              strokeWidth={1.6}
              aria-label={t("agents.composer.effortHelp")}
            />
          </div>
          <div className="mb-2.5 flex justify-between text-ui text-muted-foreground">
            <span>{t("agents.composer.effortFaster")}</span>
            <span>{t("agents.composer.effortSmarter")}</span>
          </div>
          <Slider
            data-testid="composer-effort-slider"
            aria-label={t("agents.composer.effort")}
            min={0}
            max={levels.length - 1}
            step={1}
            value={[effort]}
            onValueChange={(v) => setEffort(v[0])}
            // DS slider (design-sync-v2 §1): square thumb, per-instance.
            className="[&_[role=slider]]:rounded-sm"
          />
        </div>

        {/* Plan usage section */}
        <div className="mt-3.5 border-t border-border pt-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("agents.composer.planUsage")}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
          </div>
          <div className="flex flex-col gap-2.5">
            {plan.map((row) => (
              <div key={row.id} data-testid={`plan-row-${row.id}`}>
                <div className="mb-1 flex items-baseline justify-between gap-2.5">
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-foreground">
                    {row.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-[11.5px] text-muted-foreground">
                    {row.detail}
                  </span>
                </div>
                <Progress value={row.pct} className={cn("h-1 bg-muted", TONE_CLASS[row.tone])} />
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

