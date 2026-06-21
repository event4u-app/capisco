import { useTranslation } from "react-i18next";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { SignalItem, SignalSeverity } from "@/contracts";
import { signalSnapshot } from "@/mocks";
import { useLayout } from "../store";

/** Severity dot colour role (token roles, no hardcoded hex). */
function sevDotClass(sev: SignalSeverity): string {
  switch (sev) {
    case "waiting":
      return "bg-primary";
    case "success":
      return "bg-success";
    case "warning":
      return "bg-warning";
    case "idle":
      return "bg-muted-foreground";
  }
}

/**
 * Alerts / Inspect flyout body (build-spec §2 / §3 right-bar tools). Both are
 * just two VIEWS of the ONE shared signal surface (§5.2): `signalsFor(channel)`
 * folds PR / container / observability / agent / lint sources into a single
 * `SignalItem` shape via the dumb routing rules.
 *
 * The head carries a pin toggle: unpinned = overlay (closes on a workspace
 * click), pinned = docked column (center shrinks). The host (Shell) renders the
 * two modes; this component is the shared body.
 */
export function SignalFlyout({
  channel,
  overlay = false,
}: {
  channel: "alerts" | "inspect";
  overlay?: boolean;
}) {
  const { t } = useTranslation();
  const pinned = useLayout((s) => s.pinnedFlyouts.includes(channel));
  const togglePin = useLayout((s) => s.togglePin);
  const items = signalSnapshot.signalsFor(channel);

  return (
    <div
      data-testid={`signal-flyout-${channel}`}
      data-pinned={pinned}
      className="flex h-full min-h-0 flex-col bg-card"
    >
      <div
        data-testid={`signal-head-${channel}`}
        className="flex h-[34px] shrink-0 items-center gap-1.5 border-b border-border px-2 pl-3 text-micro font-medium uppercase tracking-wide text-muted-foreground"
      >
        <span className="truncate">{t(`signals.${channel}.title`)}</span>
        {/* Honest scope note: these are views of ONE shared rail (§5.2). */}
        <span className="truncate font-mono text-[10px] normal-case tracking-normal text-muted-foreground/70">
          {t("signals.sharedRail")}
        </span>
        <button
          type="button"
          data-testid={`signal-pin-${channel}`}
          aria-pressed={pinned}
          aria-label={pinned ? t("signals.unpin") : t("signals.pin")}
          title={pinned ? t("signals.unpin") : t("signals.pin")}
          onClick={() => togglePin(channel)}
          className={cn(
            "ml-auto flex size-5 items-center justify-center rounded-sm hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            pinned ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Icon icon={pinned ? PinOff : Pin} size={13} />
        </button>
      </div>

      {items.length === 0 ? (
        <p data-testid={`signal-empty-${channel}`} className="px-3 py-2 text-micro text-muted-foreground">
          {t("signals.empty")}
        </p>
      ) : (
        <ul
          data-testid={`signal-list-${channel}`}
          aria-label={t(`signals.${channel}.title`)}
          className="min-h-0 flex-1 overflow-auto py-1"
        >
          {items.map((s) => (
            <SignalRow key={s.id} item={s} overlay={overlay} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SignalRow({ item, overlay }: { item: SignalItem; overlay?: boolean }) {
  const { t } = useTranslation();
  return (
    <li>
      <button
        type="button"
        data-testid={`signal-item-${item.id}`}
        data-source={item.source}
        // Overlay flyout must NOT close when interacting with its own items.
        onClick={overlay ? (e) => e.stopPropagation() : undefined}
        className="flex w-full items-start gap-2.5 border-b border-border px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          data-testid={`signal-dot-${item.id}`}
          className={cn("mt-1.5 size-[7px] shrink-0 rounded-full", sevDotClass(item.sev))}
          aria-hidden
        />
        <span className="min-w-0">
          <span className="block truncate text-ui text-foreground">{item.title}</span>
          <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
            {item.sub}
          </span>
        </span>
        <span className="ml-auto shrink-0 self-center font-mono text-[9px] uppercase tracking-wide text-muted-foreground/70">
          {t(`signals.source.${item.source}`)}
        </span>
      </button>
    </li>
  );
}
