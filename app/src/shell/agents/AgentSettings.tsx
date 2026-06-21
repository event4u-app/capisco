import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  CircleCheck,
  Download,
  ExternalLink,
  Lock,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agentSnapshot } from "@/mocks";
import type { AgentBackend } from "@/contracts";
import { useAgents } from "./store";

/**
 * Agent backend settings — API client (provider + token, "stored in your OS
 * keychain") OR installed CLI (detected binary + path). The keychain / CLI
 * detection are mock providers behind the BackendConfig interface (UI shell).
 *
 * Rendered as a focus-trapping panel anchored under the gear (prototype
 * `.agent-settings`). Esc / outside-click / close button dismiss it.
 */
export function AgentSettings({
  backendKind,
  setBackendKind,
  onClose,
}: {
  backendKind: "api" | "cli";
  setBackendKind: (k: "api" | "cli") => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [token, setToken] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const cli = agentSnapshot.detectedCli;
  const backends = agentSnapshot.backends;
  const selectedBackendId = useAgents((s) => s.selectedBackendId);
  const setSelectedBackend = useAgents((s) => s.setSelectedBackend);
  // Records the last install attempt's audited target (broker-gated, never
  // silent). The real install runs through `provision.install` on the sidecar;
  // here it surfaces the exact command the broker would authorize.
  const [installAttempt, setInstallAttempt] = React.useState<string | null>(null);

  // Focus the first control on open; trap Tab within the panel; Esc closes.
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const list = Array.from(focusables);
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Outside click dismisses (the gear handles its own toggle).
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      const target = e.target as Node;
      if (el && !el.contains(target) && !(target as HTMLElement).closest?.('[data-testid="session-gear"]')) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t("agents.settings.title")}
      data-testid="agent-settings"
      className="absolute right-2 top-[calc(var(--tabbar-h)+6px)] z-30 w-[300px] rounded-md border border-border-strong bg-card p-2.5 shadow-md"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("agents.settings.title")}
        </span>
        <button
          type="button"
          aria-label={t("agents.settings.close")}
          data-testid="agent-settings-close"
          onClick={onClose}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-3.5" strokeWidth={1.6} />
        </button>
      </div>

      <div
        role="group"
        aria-label={t("agents.settings.title")}
        className="mb-2.5 flex gap-0.5 rounded-sm border border-border bg-muted p-0.5"
      >
        {(["api", "cli"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={backendKind === k}
            data-testid={`agent-settings-${k}`}
            onClick={() => setBackendKind(k)}
            className={cn(
              "h-6 flex-1 rounded-sm text-ui focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              backendKind === k
                ? "bg-primary/20 font-medium text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "api" ? t("agents.settings.apiClient") : t("agents.settings.installedCli")}
          </button>
        ))}
      </div>

      {backendKind === "api" ? (
        <div className="flex flex-col gap-1.5" data-testid="agent-settings-api-body">
          <label className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("agents.settings.provider")}
          </label>
          <button
            type="button"
            className="flex h-7 items-center justify-between rounded-sm border border-border bg-muted px-2 text-ui text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Anthropic · Claude
            <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
          </button>
          <label
            htmlFor="agent-api-token"
            className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("agents.settings.apiToken")}
          </label>
          <Input
            id="agent-api-token"
            type="password"
            className="font-mono"
            placeholder="sk-ant-…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
            <Lock className="size-3 text-muted-foreground" strokeWidth={1.6} />
            {t("agents.settings.keychainNote")}
          </div>
          <Button variant="default" size="md" className="mt-0.5 w-full" onClick={onClose}>
            {t("agents.settings.save")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5" data-testid="agent-settings-cli-body">
          <div className="flex items-center gap-1.5 text-ui text-foreground">
            <CircleCheck className="size-3.5 text-success" strokeWidth={1.6} />
            {t("agents.settings.detected", { name: cli.provider })}
          </div>
          <div className="font-mono text-micro text-muted-foreground">{cli.detail}</div>
          <div className="text-micro text-muted-foreground">{t("agents.settings.cliNote")}</div>
          <Button variant="outline" size="md" className="mt-0.5 w-full">
            {t("agents.settings.redetect")}
          </Button>
        </div>
      )}

      {/* Backend catalog (B8 P3) — Stub / Claude Code native / Claude Code via
          ACP / Codex, each with status + Use/Install/Guide. CLI-tab ONLY: these
          are installed-CLI backends; the API tab is the provider+token path and
          must not surface Install/Use. The stub stays the default; selecting a
          backend persists. Install is broker-gated. */}
      {backendKind === "cli" && (
      <div className="mt-2.5 border-t border-border pt-2.5" data-testid="agent-settings-backends">
        <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("agents.settings.backends")}
        </span>
        <ul className="flex flex-col gap-1">
          {backends.map((b) => (
            <BackendRow
              key={b.id}
              backend={b}
              selected={b.id === selectedBackendId}
              onUse={() => setSelectedBackend(b.id)}
              onInstall={() =>
                setInstallAttempt((b.installCommand ?? []).join(" "))
              }
            />
          ))}
        </ul>
        {installAttempt !== null && (
          <div
            className="mt-1.5 flex items-start gap-1.5 text-micro text-muted-foreground"
            data-testid="agent-settings-install-gate"
          >
            <Lock className="mt-0.5 size-3 shrink-0 text-muted-foreground" strokeWidth={1.6} />
            <span>
              {t("agents.settings.installGated")}
              <code className="ml-1 font-mono text-foreground">{installAttempt}</code>
            </span>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

/** Status → translation-key + tone for the backend badge. */
const STATUS_META: Record<
  AgentBackend["status"],
  { key: string; tone: string }
> = {
  ready: { key: "agents.settings.statusReady", tone: "text-success" },
  installable: { key: "agents.settings.statusInstallable", tone: "text-primary" },
  guide: { key: "agents.settings.statusGuide", tone: "text-muted-foreground" },
};

/**
 * One backend row: label + status badge + the right action. `ready` backends
 * are selectable (Use / In use); `installable` backends offer a broker-gated
 * Install; `guide` backends link to the setup doc. No action mutates the host —
 * Install only surfaces the audited command the broker would authorize.
 */
function BackendRow({
  backend,
  selected,
  onUse,
  onInstall,
}: {
  backend: AgentBackend;
  selected: boolean;
  onUse: () => void;
  onInstall: () => void;
}) {
  const { t } = useTranslation();
  const meta = STATUS_META[backend.status];
  return (
    <li
      data-testid={`agent-backend-${backend.id}`}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "flex items-center justify-between gap-2 rounded-sm border px-2 py-1.5",
        selected ? "border-primary/60 bg-primary/10" : "border-border bg-muted",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {selected && (
            <CircleCheck className="size-3 shrink-0 text-primary" strokeWidth={1.8} />
          )}
          <span className="truncate text-ui text-foreground">{backend.label}</span>
        </div>
        <span className={cn("text-micro", meta.tone)} data-testid={`agent-backend-${backend.id}-status`}>
          {t(meta.key)}
        </span>
      </div>

      {backend.status === "ready" ? (
        <Button
          variant={selected ? "ghost" : "outline"}
          size="sm"
          disabled={selected}
          data-testid={`agent-backend-${backend.id}-use`}
          onClick={onUse}
        >
          {selected ? t("agents.settings.inUse") : t("agents.settings.use")}
        </Button>
      ) : backend.status === "installable" ? (
        <Button
          variant="outline"
          size="sm"
          data-testid={`agent-backend-${backend.id}-install`}
          onClick={onInstall}
        >
          <Download className="mr-1 size-3" strokeWidth={1.8} />
          {t("agents.settings.install")}
        </Button>
      ) : (
        <a
          href={backend.guideUrl}
          target="_blank"
          rel="noreferrer"
          data-testid={`agent-backend-${backend.id}-guide`}
          className="inline-flex items-center gap-1 text-micro text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t("agents.settings.guide")}
          <ExternalLink className="size-3" strokeWidth={1.8} />
        </a>
      )}
    </li>
  );
}
