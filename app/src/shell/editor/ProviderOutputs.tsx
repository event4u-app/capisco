import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitBranchPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import type { BlameLine, InlayHint, PresenceMarker } from "@/contracts";

const LINE_H = 19.5; // 13px × 1.5 line-height — matches the CM6 theme.

/**
 * Inline blame for the active line — MOCK BlameLine output (Council-P1), shown
 * as a muted trailing annotation (author · date · summary).
 */
export function InlineBlame({ blame }: { blame: BlameLine | undefined }) {
  const { t } = useTranslation();
  if (!blame) return null;
  return (
    <div
      data-testid="inline-blame"
      role="note"
      className="pointer-events-none absolute right-3 z-10 font-mono text-micro italic text-muted-foreground"
      style={{ top: `${(blame.line - 1) * LINE_H + 4}px` }}
      aria-label={t("editor.blame")}
    >
      {blame.author}, {blame.date} · {blame.summary}
    </div>
  );
}

/**
 * Inlay hints (parameter names) — MOCK InlayHint output. Surfaced as a compact
 * legend so they read without pixel-gluing to CM6 glyph columns (the honest,
 * robust rendering of a provider output, not a CM6 feature).
 */
export function InlayHints({ hints }: { hints: InlayHint[] }) {
  const { t } = useTranslation();
  if (hints.length === 0) return null;
  return (
    <div
      data-testid="inlay-hints"
      role="note"
      className="pointer-events-none absolute bottom-2 right-3 z-10 flex flex-wrap items-center gap-1.5 rounded-[3px] bg-card/80 px-2 py-1 font-mono text-micro text-muted-foreground"
      aria-label={t("editor.inlayHints")}
    >
      <span className="not-italic text-muted-foreground/70">{t("editor.inlayHints")}:</span>
      {hints.map((h, i) => (
        <span
          key={`${h.line}-${h.col}-${i}`}
          data-testid={`inlay-${h.line}-${h.col}`}
          className="rounded-[3px] bg-muted px-1 italic text-muted-foreground"
        >
          {h.label}
        </span>
      ))}
    </div>
  );
}

function LivePresence({
  marker,
  onClose,
}: {
  marker: PresenceMarker;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);

  // Focus trap + Esc close (keyboard / a11y).
  React.useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("editor.presence.popupLabel", { who: marker.who })}
        data-testid="live-presence-popup"
        tabIndex={-1}
        className="absolute left-12 top-[18.5rem] z-40 flex max-h-[60vh] w-[min(80%,28rem)] flex-col overflow-hidden rounded-[5px] border border-border bg-popover shadow-md focus-visible:outline-none"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <span
            aria-hidden
            className="flex size-6 items-center justify-center rounded-full bg-primary/20 font-mono text-micro text-primary"
          >
            {marker.init}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-ui text-foreground">{marker.who}</div>
            <div className="truncate font-mono text-micro text-muted-foreground">
              {marker.branch}
              {marker.pr ? ` · ${marker.pr}` : ""} · {marker.when}
            </div>
          </div>
          <button
            type="button"
            aria-label={t("editor.presence.close")}
            data-testid="live-presence-close"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={X} size={14} />
          </button>
        </div>
        <div
          data-testid="live-presence-diff"
          className="min-h-0 flex-1 overflow-auto py-1 font-mono text-code"
        >
          {marker.diff.map((d, i) => (
            <div
              key={i}
              className={cn(
                "flex min-w-max items-center gap-2 px-3 leading-5",
                d.sign === "+" ? "bg-success/15" : "bg-destructive/15",
              )}
            >
              <span className="w-6 shrink-0 select-none text-right text-muted-foreground">
                {d.line}
              </span>
              <span
                className={cn(
                  "w-3 shrink-0 select-none text-center",
                  d.sign === "+" ? "text-success" : "text-destructive",
                )}
              >
                {d.sign}
              </span>
              <span className="whitespace-pre text-foreground">{d.text}</span>
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <button
            type="button"
            data-testid="cherry-pick"
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-ui text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon icon={GitBranchPlus} size={13} />
            {t("editor.presence.cherryPick")}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Social-presence lane (left of the line numbers) — MOCK PresenceMarker output:
 * a colleague avatar plus a teal bar over the lines they touched. Clicking the
 * avatar opens the live-presence popup (identity · diff · cherry-pick).
 */
export function SocialPresenceLane({ markers }: { markers: PresenceMarker[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState<string | null>(null);
  const active = markers.find((m) => m.who === open) ?? null;

  return (
    <div
      data-testid="social-lane"
      role="group"
      className="relative w-6 shrink-0 border-r border-border bg-editor"
      aria-label={t("editor.presence.lane")}
    >
      {markers.map((m) => {
        const top = (m.fromLine - 1) * LINE_H + 4;
        const height = (m.toLine - m.fromLine + 1) * LINE_H;
        return (
          <React.Fragment key={m.who}>
            <span
              aria-hidden
              data-testid={`presence-bar-${m.who}`}
              className="absolute right-0 w-0.5 bg-primary"
              style={{ top: `${top}px`, height: `${height}px` }}
            />
            <button
              type="button"
              data-testid={`presence-avatar-${m.who}`}
              aria-label={t("editor.presence.openLabel", { who: m.who })}
              onClick={() => setOpen((v) => (v === m.who ? null : m.who))}
              className="absolute left-1/2 flex size-4 -translate-x-1/2 items-center justify-center rounded-full bg-primary/20 font-mono text-[8px] text-primary hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              style={{ top: `${top}px` }}
            >
              {m.init}
            </button>
          </React.Fragment>
        );
      })}
      {active && <LivePresence marker={active} onClose={() => setOpen(null)} />}
    </div>
  );
}
