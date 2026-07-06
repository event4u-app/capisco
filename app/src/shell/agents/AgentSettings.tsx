import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleCheck, Download, ExternalLink, Lock, X } from "lucide-react";

import { agentSnapshot } from "@/mocks";
import type { AgentBackend } from "@/contracts";
import { getProviders } from "@/lib/desktop-shell";
import { useAgents, type TerseLevel } from "./store";

/**
 * Agent backend settings — 1:1 port of the prototype `AgentSettings`
 * (`ui_kits/capisco-ide/agent.jsx`). Markup + class names (`.agent-settings`,
 * `.as-*`, `.bk-*`, `.trow-*`) are transcribed verbatim; styling lives in
 * styles/capisco-composer.css. The React logic (focus trap, dynamic backends,
 * broker-gated install, token-economy toggles) and all testids are preserved.
 *
 * Rendered as a focus-trapping panel anchored under the gear. Esc /
 * outside-click / close button dismiss it.
 */
export function AgentSettings({
  backendKind,
  setBackendKind,
  onClose,
  routingEnabled,
  setRoutingEnabled,
  terseEnabled,
  setTerseEnabled,
  terseLevel,
  setTerseLevel,
}: {
  backendKind: "api" | "cli";
  setBackendKind: (k: "api" | "cli") => void;
  onClose: () => void;
  /** Token-economy: auto model routing (default off). Just a toggle — the
   * prototype has no model dropdown here; the effective model is the session
   * tab badge. */
  routingEnabled: boolean;
  setRoutingEnabled: (on: boolean) => void;
  /** Token-economy: Caveman terse mode (default on) + level. */
  terseEnabled: boolean;
  setTerseEnabled: (on: boolean) => void;
  terseLevel: TerseLevel;
  setTerseLevel: (l: TerseLevel) => void;
}) {
  const { t } = useTranslation();
  const [token, setToken] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const cli = agentSnapshot.detectedCli;
  // Real backend catalog (P1) — seeded with the snapshot (first render + goldens
  // unchanged) then replaced by the provider's `detect()` result. In the browser
  // that is the deterministic mock backend; on desktop it is the real host scan.
  // Fixes the "picker is cosmetic" bug (the catalog was a static mock, `detect()`
  // was never called).
  const [backends, setBackends] = React.useState<AgentBackend[]>(agentSnapshot.backends);
  const redetect = React.useCallback(() => {
    void getProviders()
      .agentBackend.detect()
      .then((list) => {
        if (list.length) setBackends(list);
      });
  }, []);
  React.useEffect(() => {
    let alive = true;
    void getProviders()
      .agentBackend.detect()
      .then((list) => {
        if (alive && list.length) setBackends(list);
      });
    return () => {
      alive = false;
    };
  }, []);
  const selectedBackendId = useAgents((s) => s.selectedBackendId);
  const setSelectedBackend = useAgents((s) => s.setSelectedBackend);
  const scopedGrantsEnabled = useAgents((s) => s.scopedGrantsEnabled);
  const setScopedGrantsEnabled = useAgents((s) => s.setScopedGrantsEnabled);
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
      if (
        el &&
        !el.contains(target) &&
        !(target as HTMLElement).closest?.('[data-testid="session-gear"]')
      ) {
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
      className="agent-settings"
    >
      <div className="as-head">
        <span className="caps">{t("agents.settings.title")}</span>
        <button
          type="button"
          className="as-close"
          aria-label={t("agents.settings.close")}
          data-testid="agent-settings-close"
          onClick={onClose}
        >
          <X size={14} color="var(--ds-text-secondary)" strokeWidth={2} />
        </button>
      </div>

      <div className="as-seg" role="group" aria-label={t("agents.settings.title")}>
        {(["api", "cli"] as const).map((k) => (
          <button
            key={k}
            type="button"
            className={"as-opt" + (backendKind === k ? " active" : "")}
            aria-pressed={backendKind === k}
            data-testid={`agent-settings-${k}`}
            onClick={() => setBackendKind(k)}
          >
            {k === "api" ? t("agents.settings.apiClient") : t("agents.settings.installedCli")}
          </button>
        ))}
      </div>

      {backendKind === "api" ? (
        <div className="as-body" data-testid="agent-settings-api-body">
          <label className="as-label">{t("agents.settings.provider")}</label>
          <button type="button" className="as-select">
            Anthropic · Claude
            <ChevronDown size={13} color="var(--ds-text-secondary)" strokeWidth={1.6} />
          </button>
          <label className="as-label" htmlFor="agent-api-token">
            {t("agents.settings.apiToken")}
          </label>
          <input
            id="agent-api-token"
            type="password"
            className="as-input"
            placeholder="sk-ant-…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <div className="as-note">
            <Lock size={11} color="var(--ds-text-tertiary)" strokeWidth={1.6} />
            {t("agents.settings.keychainNote")}
          </div>
          <button type="button" className="as-btn as-btn-primary" onClick={onClose}>
            {t("agents.settings.save")}
          </button>
        </div>
      ) : (
        <div className="as-body" data-testid="agent-settings-cli-body">
          <div className="as-detected">
            <CircleCheck size={14} color="var(--ds-success)" strokeWidth={1.6} />
            {t("agents.settings.detected", { name: cli.provider })}
          </div>
          <div className="as-path">{cli.detail}</div>
          <div className="as-note">{t("agents.settings.cliNote")}</div>
          <button
            type="button"
            className="as-btn as-btn-default"
            data-testid="agent-settings-redetect"
            onClick={redetect}
          >
            {t("agents.settings.redetect")}
          </button>

          {/* Backend catalog (B8 P3) — dynamic backends with Use/Install/Guide.
              CLI-tab only. The stub stays the default; selecting persists.
              Install is broker-gated (surfaces the audited command only). */}
          <div className="as-backends" data-testid="agent-settings-backends">
            <span className="caps">{t("agents.settings.backends")}</span>
            {backends.map((b) => (
              <BackendRow
                key={b.id}
                backend={b}
                selected={b.id === selectedBackendId}
                onUse={() => {
                  // P1 — reflect locally AND drive the sidecar selection (the
                  // load-bearing fix: `onUse` used to only set a local string,
                  // so the run never used the picked backend).
                  setSelectedBackend(b.id);
                  void getProviders().agentBackend.select(b.id);
                }}
                onInstall={() => setInstallAttempt((b.installCommand ?? []).join(" "))}
              />
            ))}
            {installAttempt !== null && (
              <div className="as-gate" data-testid="agent-settings-install-gate">
                <Lock size={12} color="var(--ds-text-tertiary)" strokeWidth={1.6} />
                <span>
                  {t("agents.settings.installGated")}
                  <code>{installAttempt}</code>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Token economy — Auto model routing (toggle only, no dropdown) + Caveman
          terse mode with level row. Prototype `.as-sec` / `.as-toggle`. */}
      <div className="as-sec" data-testid="agent-settings-token-economy">
        <span className="caps">{t("agents.settings.tokenEconomy")}</span>

        <div className="as-toggle">
          <div className="as-toggle-main">
            <Switch
              checked={routingEnabled}
              onChange={() => setRoutingEnabled(!routingEnabled)}
              label={t("agents.settings.autoRoute")}
              testId="agent-settings-routing-toggle"
            />
            <div className="as-toggle-text">
              <div className="as-toggle-title">{t("agents.settings.autoRoute")}</div>
              <div className="as-toggle-sub">{t("agents.settings.autoRouteSub")}</div>
            </div>
          </div>
        </div>

        <div className="as-toggle">
          <div className="as-toggle-main">
            <Switch
              checked={terseEnabled}
              onChange={() => setTerseEnabled(!terseEnabled)}
              label={t("agents.settings.terseTitle")}
              testId="agent-settings-terse-toggle"
            />
            <div className="as-toggle-text">
              <div className="as-toggle-title">
                {t("agents.settings.terseTitle")}
                <span className="as-tag">Caveman</span>
              </div>
              <div className="as-toggle-sub">{t("agents.settings.terseSub")}</div>
            </div>
          </div>
          {terseEnabled && (
            <div className="trow-seg as-level">
              {(["lite", "full", "ultra"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={"trow-opt" + (terseLevel === l ? " active" : "")}
                  aria-pressed={terseLevel === l}
                  data-testid={`agent-settings-terse-level-${l}`}
                  onClick={() => setTerseLevel(l)}
                >
                  {t(
                    l === "lite"
                      ? "agents.composer.terseLevelLite"
                      : l === "full"
                        ? "agents.composer.terseLevelFull"
                        : "agents.composer.terseLevelUltra",
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="as-sec" data-testid="agent-settings-permissions">
        <span className="caps">{t("agents.settings.permissions")}</span>
        <div className="as-toggle">
          <div className="as-toggle-main">
            <Switch
              checked={scopedGrantsEnabled}
              onChange={() => setScopedGrantsEnabled(!scopedGrantsEnabled)}
              label={t("agents.settings.scopedGrantsTitle")}
              testId="agent-settings-scoped-grants-toggle"
            />
            <div className="as-toggle-text">
              <div className="as-toggle-title">{t("agents.settings.scopedGrantsTitle")}</div>
              <div className="as-toggle-sub">{t("agents.settings.scopedGrantsSub")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The on/off switch (prototype `.as-switch` / `.as-knob`). */
function Switch({
  checked,
  onChange,
  label,
  testId,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={onChange}
      className={"as-switch" + (checked ? " on" : "")}
    >
      <span className="as-knob" />
    </button>
  );
}

/** Status → translation-key + state class for the backend row. */
const STATUS_META: Record<AgentBackend["status"], { key: string; cls: string }> = {
  ready: { key: "agents.settings.statusReady", cls: "bk-ready" },
  installable: { key: "agents.settings.statusInstallable", cls: "bk-installable" },
  guide: { key: "agents.settings.statusGuide", cls: "bk-guide-state" },
};

/**
 * One backend row (prototype `.bk-row`): label + status + the right action.
 * `ready` = selectable (Use / In use, active row tinted); `installable` =
 * broker-gated Install; `guide` = setup-doc link. Install only surfaces the
 * audited command the broker would authorize — no host mutation.
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
    <div
      data-testid={`agent-backend-${backend.id}`}
      data-selected={selected ? "true" : undefined}
      className={"bk-row" + (selected ? " bk-active" : "")}
    >
      <div className="bk-main">
        <div className="bk-name">
          {selected && <CircleCheck size={13} color="var(--ds-accent)" strokeWidth={1.8} />}
          {backend.label}
        </div>
        <div
          className={"bk-state " + meta.cls}
          data-testid={`agent-backend-${backend.id}-status`}
        >
          {t(meta.key)}
        </div>
      </div>

      {backend.status === "ready" ? (
        <button
          type="button"
          className="bk-use"
          disabled={selected}
          data-testid={`agent-backend-${backend.id}-use`}
          onClick={onUse}
        >
          {selected ? t("agents.settings.inUse") : t("agents.settings.use")}
        </button>
      ) : backend.status === "installable" ? (
        <button
          type="button"
          className="bk-install"
          data-testid={`agent-backend-${backend.id}-install`}
          onClick={onInstall}
        >
          <Download size={13} strokeWidth={1.8} />
          {t("agents.settings.install")}
        </button>
      ) : (
        <a
          href={backend.guideUrl}
          target="_blank"
          rel="noreferrer"
          className="bk-guide"
          data-testid={`agent-backend-${backend.id}-guide`}
        >
          {t("agents.settings.guide")}
          <ExternalLink size={12} strokeWidth={1.8} />
        </a>
      )}
    </div>
  );
}
