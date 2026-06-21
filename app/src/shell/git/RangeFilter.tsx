import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const PRESETS = ["all", "day", "week", "month"] as const;
const CUSTOM_PRESETS = [
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;

export type RangeValue = (typeof PRESETS)[number] | (typeof CUSTOM_PRESETS)[number] | "custom";

/**
 * Date-range filter present on every Git-Dashboard tab (build-spec §5 /
 * prototype gitw-filter): All / Day / Week / Month presets + a Custom popover
 * with extra presets and From/To date inputs. Keyboard-reachable; the popover
 * closes on Escape and on outside click. State is lifted to the workspace.
 */
export function RangeFilter({
  value,
  onChange,
  from,
  to,
  onFrom,
  onTo,
}: {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const customActive = !(PRESETS as readonly string[]).includes(value);

  // Close the popover on Escape regardless of where focus sits (the trigger
  // keeps focus after the click, so a dialog-scoped handler would miss it).
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      data-testid="git-range"
      className="flex items-center gap-0.5 rounded-sm border border-border p-0.5 text-micro"
      role="group"
      aria-label={t("git.filter")}
    >
      {PRESETS.map((r) => (
        <button
          key={r}
          type="button"
          data-testid={`git-range-${r}`}
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-[2px] px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value === r ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`git.range.${r}`)}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          data-testid="git-range-custom"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-pressed={customActive}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            customActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {customActive && value !== "custom" ? t(`git.rangePreset.${value}`) : t("git.range.custom")}
          <Icon icon={ChevronDown} size={12} />
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              data-testid="git-range-pop"
              role="dialog"
              aria-label={t("git.range.custom")}
              className="absolute right-0 z-50 mt-1 w-56 rounded-md border border-border bg-popover p-2 shadow-lg"
            >
              <div className="flex flex-col gap-0.5">
                {CUSTOM_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-testid={`git-rangepreset-${p}`}
                    aria-pressed={value === p}
                    onClick={() => {
                      onChange(p);
                      setOpen(false);
                    }}
                    className={cn(
                      "rounded-sm px-2 py-1 text-left text-micro transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      value === p ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60",
                    )}
                  >
                    {t(`git.rangePreset.${p}`)}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5 border-t border-border pt-2">
                <label htmlFor="git-from" className="text-micro text-muted-foreground">
                  {t("git.from")}
                </label>
                <input
                  id="git-from"
                  data-testid="git-from"
                  type="date"
                  value={from}
                  onChange={(e) => {
                    onFrom(e.target.value);
                    onChange("custom");
                  }}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-micro text-foreground"
                />
                <label htmlFor="git-to" className="text-micro text-muted-foreground">
                  {t("git.to")}
                </label>
                <input
                  id="git-to"
                  data-testid="git-to"
                  type="date"
                  value={to}
                  onChange={(e) => {
                    onTo(e.target.value);
                    onChange("custom");
                  }}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-micro text-foreground"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
