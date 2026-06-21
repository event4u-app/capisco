import { useTranslation } from "react-i18next";
import { Box, FunctionSquare, Variable, Hash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { CompletionItem } from "@/contracts";

// Symbol-kind → leading glyph (build-spec §7: icons per symbol type).
const KIND_ICON: Record<string, LucideIcon> = {
  method: FunctionSquare,
  function: FunctionSquare,
  field: Box,
  property: Hash,
  variable: Variable,
};

/**
 * Autocomplete popup — a MOCK provider output (CompletionItem[]), not a CM6
 * feature (Council-P1). Icons per symbol kind; the first (selected) entry is
 * teal. Positioned over the editor at the call site.
 */
export function Autocomplete({ items }: { items: CompletionItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <div
      data-testid="autocomplete"
      role="listbox"
      aria-label={t("editor.autocomplete")}
      className="pointer-events-auto absolute left-[22ch] top-[18rem] z-20 w-72 overflow-hidden rounded-[5px] border border-border bg-popover py-1 shadow-md"
    >
      {items.map((it, i) => {
        const IconCmp = KIND_ICON[it.kind] ?? Variable;
        const selected = i === 0;
        return (
          <div
            key={it.label}
            role="option"
            aria-selected={selected}
            data-testid={`ac-item-${it.label}`}
            data-selected={selected || undefined}
            className={cn(
              "flex h-6 items-center gap-2 px-2 font-mono text-code",
              selected ? "bg-accent text-primary" : "text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center",
                selected ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon icon={IconCmp} size={12} />
            </span>
            <span className="shrink-0">{it.label}</span>
            {it.detail && (
              <span className="truncate text-micro text-muted-foreground">{it.detail}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
