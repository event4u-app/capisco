import * as React from "react";
import {
  ArrowUp,
  FileText,
  FolderGit2,
  Gauge,
  Link as LinkIcon,
  MessageSquare,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ContextSourceTag, RecentProject } from "@/contracts";
import { agentSnapshot } from "@/mocks";
import { pickFiles } from "@/lib/pick-files";
import { getProviders } from "@/lib/desktop-shell";
import { usePalette } from "@/shell/command-registry";
import {
  ALL_GROUPS,
  CHAT_GROUPS,
  makeCommandProvider,
} from "@/lib/autocomplete/providers/command-provider";
import { MentionAutocomplete, type MentionFieldElement } from "./MentionAutocomplete";
import { budgetTone, type CheckpointEntry, type QueuedMessage } from "./store";
import { BranchSwitcher } from "./BranchSwitcher";
import { useHistoryRecall } from "./use-history-recall";
import { useDraft } from "./use-draft";
import { useAutoGrow } from "./use-auto-grow";
import { useSmartPaste } from "./use-smart-paste";
import { useEmptyStateSuggestions } from "./use-empty-state-suggestions";
import type { EditRerunHandle } from "./use-edit-rerun";

/** Prototype fmtK — verbatim (agent.jsx). */
const fmtK = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n);

interface Chip {
  icon: "folder-git-2" | "file-text" | "file" | "link";
  label: string;
  closable?: boolean;
  /** Smart-paste chip class (P4): a fetched-URL ref or a collapsed long paste. */
  kind?: "url-fetch" | "collapsed-text";
  /** The URL for a `url-fetch` chip. */
  url?: string;
  /** The collapsed body for a `collapsed-text` chip (kept out of the textarea). */
  content?: string;
  /** Absolute fs path of a picked file (desktop only) — the ingestion handle
   * (road-to-composer-context-runtime P2). Browser-picked files have none. */
  path?: string;
  /** Origin tag from the broker-gated ingestion (`prod:*` = read-only). */
  tag?: ContextSourceTag;
  /** A refused ingestion (secret-form / denied) — shown with a warning. */
  refused?: boolean;
  /** Why the ingestion was refused (chip title). */
  reason?: string;
}
const CHIP_ICON = {
  "folder-git-2": FolderGit2,
  "file-text": FileText,
  file: FileText,
  link: LinkIcon,
} as const;

const PLAN_COLOR: Record<string, string> = {
  accent: "var(--ds-accent)",
  warning: "var(--ds-warning)",
  tertiary: "var(--ds-text-tertiary)",
};

/**
 * Composer — 1:1 port of the design-system prototype's `Composer`
 * (`agents/tmp/design-system/ui_kits/capisco-ide/agent.jsx`). Markup + class
 * names are transcribed verbatim; styling lives in `styles/capisco-composer.css`
 * (the prototype `.cmp*`/`.cb-*`/`.ctx-*`/`.tune-*` CSS, design tokens as --ds-*).
 * The only deviation from the prototype is the textarea: it routes through
 * `MentionAutocomplete` (multiline, bare) so the @-mention feature is preserved,
 * while wearing the exact `cmp-ta` class.
 */
export function Composer({
  isChat,
  effort,
  setEffort,
  statusText,
  used,
  budget,
  setBudget,
  routingEnabled,
  setRoutingEnabled,
  composerRef,
  onSend,
  running = false,
  onStop,
  currentProject,
  onOpenReference,
  sessionId,
  promptLog = [],
  initialDraft = "",
  saveDraft,
  clearDraft,
  projectRoot,
  promptLogs = {},
  editRerun,
  queue = [],
  onRemoveQueued,
  onReorderQueued,
  onEditQueued,
  checkpoints = [],
  onJumpCheckpoint,
}: {
  isChat: boolean;
  effort: number;
  setEffort: (n: number) => void;
  statusText: string;
  used: number;
  budget: number;
  setBudget: (n: number) => void;
  routingEnabled: boolean;
  setRoutingEnabled: (on: boolean) => void;
  composerRef: React.RefObject<MentionFieldElement | null>;
  onSend: () => void;
  /** Whether THIS session has a run in flight (drives Send↔Stop). */
  running?: boolean;
  /** Cancel the in-flight run (P3). Required for the Stop affordance to fire. */
  onStop?: () => void;
  currentProject?: string;
  onOpenReference?: (project: RecentProject) => Promise<boolean>;
  /** Active session id — keys the per-session prompt-log + draft (P4). */
  sessionId?: string;
  /** This session's sent-prompt log, most-recent-LAST (P4 history-recall). */
  promptLog?: string[];
  /** Persisted unsent body restored on mount (P4 draft-persistence). */
  initialDraft?: string;
  /** Debounced draft autosave (P4). */
  saveDraft?: (id: string, body: string) => void;
  /** Clear the persisted draft (P4). */
  clearDraft?: (id: string) => void;
  /** Absolute project root — enables `@file`/`@folder`/`@symbol` (P2). */
  projectRoot?: string;
  /** Per-session prompt-log map (P4) — feeds the empty-state suggestions (P3). */
  promptLogs?: Record<string, string[]>;
  /** Edit-&-Rerun handle (P5-A) — marks a recalled buffer for retry-branch. */
  editRerun?: EditRerunHandle;
  /** This session's message queue (P5-A) — shown while a run is in flight. */
  queue?: QueuedMessage[];
  /** Remove a queued message by id (P5-A). */
  onRemoveQueued?: (itemId: string) => void;
  /** Reorder a queued message (P5-A). */
  onReorderQueued?: (from: number, to: number) => void;
  /** Edit a queued message's text (P5-A). */
  onEditQueued?: (itemId: string, text: string) => void;
  /** Named checkpoints for the active session (S8) — feeds the branch-switcher. */
  checkpoints?: CheckpointEntry[];
  /** Jump to a checkpoint's divergent line (S8) — forks from its leaf. */
  onJumpCheckpoint?: (entry: CheckpointEntry) => void;
}) {
  const { t } = useTranslation();
  const levels = agentSnapshot.effortLevels;
  const plan = agentSnapshot.planUsage;
  // Live rules/guidelines size (P5) — same source as the sent system context;
  // the warning flips at the real `limit`, not a hardcoded value.
  const rulesChars = agentSnapshot.systemContext.chars;
  const rulesLimit = agentSnapshot.systemContext.limit;

  const [chips, setChips] = React.useState<Chip[]>([
    { icon: "folder-git-2", label: currentProject ?? "agent-config" },
    { icon: "file-text", label: "roadmaps-progress.md", closable: true },
  ]);
  const [dragOver, setDragOver] = React.useState(false);
  const [planMode, setPlanMode] = React.useState(false);
  const [panel, setPanel] = React.useState<"tune" | "ctx" | null>(null);
  const register = usePalette((s) => s.register);

  const togglePanel = (p: "tune" | "ctx") => setPanel((x) => (x === p ? null : p));
  const removeChip = (i: number) => setChips((c) => c.filter((_, j) => j !== i));

  // The SINGLE ingestion path both `+`-Add and Drag&Drop funnel through
  // (road-to-composer-context-runtime P2 / file-ingestion-contract): each real
  // path goes through the broker-gated `ingest.ingestFile` chokepoint — a
  // secret-form path is refused, a prod-origin path is tagged read-only, and a
  // reference (never the bytes) becomes a context chip. There is no second path.
  const ingestPaths = React.useCallback((paths: string[]) => {
    const ingest = getProviders().ingest;
    paths.forEach((path) => {
      void ingest.ingestFile(path).then((outcome) => {
        setChips((c) =>
          outcome.status === "reference"
            ? [
                ...c,
                {
                  icon: "file",
                  label: outcome.entry.displayName,
                  closable: true,
                  path: outcome.entry.path,
                  tag: outcome.entry.sourceTag,
                },
              ]
            : [
                ...c,
                {
                  icon: "file",
                  label: outcome.displayName,
                  closable: true,
                  refused: true,
                  reason: outcome.reason,
                },
              ],
        );
      });
    });
  }, []);

  // `@file` pick → the SAME broker chokepoint as `+`-Add / drop (no second path).
  const attachFile = React.useCallback(
    (absPath: string) => ingestPaths([absPath]),
    [ingestPaths],
  );

  // `+`-Add / attach / palette all funnel through the DesktopShell file-dialog
  // seam (never a raw input.click in the component). Files with a real path
  // (desktop) go through the broker ingestion chokepoint; browser-picked files
  // (name only, no path) become a plain display chip — ingestion is desktop-only.
  const addFilesViaPicker = React.useCallback(() => {
    void pickFiles({ multiple: true }).then((files) => {
      if (!files.length) return;
      const withPath = files.filter((f) => f.path).map((f) => f.path as string);
      const nameOnly = files.filter((f) => !f.path);
      if (withPath.length) ingestPaths(withPath);
      if (nameOnly.length) {
        setChips((c) => [
          ...c,
          ...nameOnly.map((f) => ({ icon: "file" as const, label: f.name, closable: true })),
        ]);
      }
    });
  }, [ingestPaths]);

  // Self-register the "add context" action in the palette (escalation ladder).
  React.useEffect(
    () =>
      register({
        id: "context:add",
        group: "tools",
        icon: Plus,
        label: t("agents.composer.contextAdd"),
        description: t("agents.composer.contextAddDesc"),
        run: addFilesViaPicker,
      }),
    [register, t, addFilesViaPicker],
  );
  // Send when idle; Stop (real cancel) when a run is in flight. The Stop icon
  // never shows without a cancellable run (`running`) — honesty-gate (P3).
  const send = () => {
    if (running) {
      onStop?.();
      return;
    }
    onSend();
  };

  // Self-register the Stop action in the palette while a run is in flight.
  React.useEffect(() => {
    if (!running || !onStop) return;
    return register({
      id: "composer:stop",
      group: "tools",
      icon: Square,
      label: t("agents.composer.stop"),
      run: onStop,
    });
  }, [register, t, running, onStop]);

  // `/`-command provider — same catalog as Cmd-K (registered commands), filtered
  // by mode. Memoized on `isChat` so the engine does not re-query each render.
  const commandProvider = React.useMemo(
    () =>
      makeCommandProvider({
        getRegistered: () => usePalette.getState().registered,
        groupFilter: isChat ? CHAT_GROUPS : ALL_GROUPS,
        onRun: () => setPanel(null), // a command runs → close any open composer panel
      }),
    [isChat],
  );
  const extraProviders = React.useMemo(() => [commandProvider], [commandProvider]);

  // ---- P4 input-reliability: draft, auto-grow, history-recall, smart-paste ----
  const sid = sessionId ?? "";
  const draft = useDraft({
    ref: composerRef,
    sessionId: sid,
    initialDraft,
    saveDraft: saveDraft ?? (() => {}),
  });
  const autoGrow = useAutoGrow(composerRef as React.RefObject<HTMLTextAreaElement | null>);
  // History-recall (P4) wired to the Edit-&-Rerun flag (P5-A): entering recall
  // marks the buffer as a recalled prompt; exiting recall clears the mark.
  const recall = useHistoryRecall(promptLog, editRerun?.onRecallExit, editRerun?.onRecallEnter);
  const safeHost = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url.slice(0, 40);
    }
  };
  const smartPaste = useSmartPaste({
    onImage: (name) => setChips((c) => [...c, { icon: "file", label: name, closable: true }]),
    onUrl: (url) =>
      setChips((c) => [
        ...c,
        { icon: "link", label: safeHost(url), closable: true, kind: "url-fetch", url },
      ]),
    onLongText: (text) =>
      setChips((c) => [
        ...c,
        {
          icon: "file-text",
          label: t("agents.composer.pastedLines", { count: text.split("\n").length }),
          closable: true,
          kind: "collapsed-text",
          content: text,
        },
      ]),
  });
  // ---- P3 empty-state next-task suggestions -------------------------------
  // Whether the (uncontrolled) textarea is empty. Starts `true` — a fresh
  // composer boots empty; a restored draft fires a synthetic input that flips
  // this to false via `handleInput`. The suggestions block renders only while
  // empty (an empty field can never carry an `@`/`/` trigger, so the
  // autocomplete overlay is structurally closed → no collision).
  const [composerEmpty, setComposerEmpty] = React.useState(true);
  const suggestions = useEmptyStateSuggestions({ promptLogs, sessionId: sid, isChat });
  // Click a suggestion → write it into the composer and re-run the input
  // pipeline (engine token-detect, draft autosave, auto-grow, empty-state).
  // NEVER sends — this is a fill, not a submit.
  const fillComposer = React.useCallback(
    (text: string) => {
      const el = composerRef.current;
      if (!el) return;
      el.value = text;
      el.setSelectionRange(text.length, text.length);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
    },
    [composerRef],
  );

  // Compose the textarea onInput: auto-grow measurement + debounced draft save
  // + empty-state sync (P3, read straight off the uncontrolled value).
  const handleInput = React.useCallback(() => {
    autoGrow.measure();
    draft.onInput();
    const el = composerRef.current;
    const empty = el ? el.value === "" : true;
    setComposerEmpty(empty);
    // Emptying the field ends any rerun-edit (P5-A) — the next buffer is fresh.
    if (empty) editRerun?.onRecallExit();
  }, [autoGrow, draft, composerRef, editRerun]);

  const ratio = budget > 0 ? used / budget : 0;
  const tone = budgetTone(used, budget); // ok | warn | crit
  const toneColor =
    tone === "ok"
      ? "var(--ds-success)"
      : tone === "warn"
        ? "var(--ds-warning)"
        : "var(--ds-error)";
  const presets = [100000, 150000, 200000, 300000];
  const fillPct = ((budget - 50000) / 350000) * 100;

  return (
    <>
      <div
        className={"cmp" + (dragOver ? " cmp-drag" : "")}
        data-testid="composer-box"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          // Same chokepoint as `+`-Add: dropped files with a real path (desktop
          // webview exposes File.path) go through broker ingestion.
          const paths = Array.from(e.dataTransfer.files)
            .map((f) => (f as File & { path?: string }).path)
            .filter((p): p is string => Boolean(p));
          if (paths.length) ingestPaths(paths);
        }}
      >
        <div className="cmp-context">
          {rulesChars > rulesLimit && (
            <span className="cmp-warn-wrap">
              <button
                type="button"
                className="cmp-ico cmp-warn"
                data-testid="composer-rules-warn"
                aria-label={t("agents.composer.rulesWarn", {
                  chars: rulesChars.toLocaleString(),
                  limit: rulesLimit.toLocaleString(),
                })}
              >
                <TriangleAlert size={14} color="var(--ds-warning)" strokeWidth={2} />
              </button>
              <span className="cmp-warn-tip" role="tooltip">
                {t("agents.composer.rulesWarn", {
                  chars: rulesChars.toLocaleString(),
                  limit: rulesLimit.toLocaleString(),
                })}
              </span>
            </span>
          )}
          {chips.map((c, i) => {
            const I = c.refused ? TriangleAlert : CHIP_ICON[c.icon];
            const title = c.refused ? c.reason : c.tag && c.tag !== "local" ? c.tag : undefined;
            return (
              <span
                key={i}
                className="cmp-chip"
                data-testid="composer-chip"
                data-refused={c.refused || undefined}
                data-tag={c.tag && c.tag !== "local" ? c.tag : undefined}
                title={title}
              >
                <I
                  size={12}
                  color={c.refused ? "var(--ds-warning)" : "var(--ds-text-secondary)"}
                  strokeWidth={2}
                />
                {c.label}
                {c.closable && (
                  <button
                    type="button"
                    className="cmp-chip-x"
                    aria-label={t("agents.composer.contextRemove")}
                    onClick={() => removeChip(i)}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          <button
            type="button"
            className="cmp-addbtn"
            data-testid="composer-add"
            title={t("agents.composer.contextAdd")}
            aria-label={t("agents.composer.contextAdd")}
            onClick={addFilesViaPicker}
          >
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Message queue (P5-A) — visible only while THIS session's run is in
            flight and at least one message is queued. Each chip is editable /
            removable / reorderable before it fires. Empty queue → no row
            (boot-invisible → golden-safe). */}
        {running && queue.length > 0 && (
          <div className="cmp-queue" data-testid="composer-queue" role="list">
            {queue.map((item, i) => (
              <span
                key={item.id}
                className="cmp-queue-chip"
                data-testid={`queue-chip-${item.id}`}
                role="listitem"
              >
                <span className="cmp-queue-pos" aria-hidden>
                  {i + 1}
                </span>
                <span
                  className="cmp-queue-text"
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label={t("agents.composer.queueEdit")}
                  data-testid={`queue-text-${item.id}`}
                  onBlur={(e) => onEditQueued?.(item.id, e.currentTarget.textContent ?? "")}
                >
                  {item.text}
                </span>
                <button
                  type="button"
                  className="cmp-queue-btn"
                  data-testid={`queue-up-${item.id}`}
                  aria-label={t("agents.composer.queueUp")}
                  disabled={i === 0}
                  onClick={() => onReorderQueued?.(i, i - 1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="cmp-queue-btn"
                  data-testid={`queue-down-${item.id}`}
                  aria-label={t("agents.composer.queueDown")}
                  disabled={i === queue.length - 1}
                  onClick={() => onReorderQueued?.(i, i + 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="cmp-queue-x"
                  data-testid={`queue-remove-${item.id}`}
                  aria-label={t("agents.composer.queueRemove")}
                  onClick={() => onRemoveQueued?.(item.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {draft.draftRestored && (
          <div
            className="cmp-draft-restored"
            data-testid="composer-draft-restored"
            role="status"
          >
            <span>{t("agents.composer.draftRestored")}</span>
            <button
              type="button"
              className="cmp-draft-clear"
              data-testid="composer-draft-clear"
              onClick={() => {
                const el = composerRef.current;
                if (el) {
                  el.value = "";
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                }
                clearDraft?.(sid);
                draft.dismissRestored();
              }}
            >
              {t("agents.composer.draftClear")}
            </button>
          </div>
        )}

        <MentionAutocomplete
          ref={composerRef}
          multiline
          rows={3}
          className="cmp-ta"
          data-testid="composer-input"
          currentProject={currentProject}
          onOpenReference={onOpenReference}
          extraProviders={extraProviders}
          projectRoot={projectRoot}
          onAttachFile={attachFile}
          placeholder={t("agents.composer.placeholder")}
          aria-label={t("agents.composer.placeholder")}
          onInput={handleInput}
          onPaste={smartPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              recall.reset();
              // Always the send path — while a run is in flight, AgentWorkspace
              // enqueues instead of starting a competing run (P5-A). The Stop
              // affordance stays on the send BUTTON (never on Cmd+Enter).
              onSend();
              return;
            }
            // History-recall (↑/↓ on an empty composer). Reaches here only when
            // the autocomplete overlay is closed (the engine consumes arrows
            // while open), so an empty-value guard inside the hook is sufficient.
            const el = e.currentTarget;
            if (recall.onKeyDown(e, el, el.value)) return;
          }}
        />

        {/* Empty-State next-task suggestions (P3) — deterministic, mode-filtered
            rows shown only while the composer is empty. Click fills the composer
            (never auto-sends); typing hides them, clearing brings them back. */}
        {composerEmpty && suggestions.length > 0 && (
          <div
            className="cmp-suggest"
            data-testid="composer-empty-suggestions"
            role="listbox"
            aria-label={t("agents.composer.suggestionsLabel")}
          >
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.id}
                role="option"
                aria-selected={false}
                className="cmp-suggest-row"
                data-testid={`composer-suggestion-${s.id}`}
                data-kind={s.kind}
                // mousedown (not click) fills before the textarea blurs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  fillComposer(s.fill);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="cmp-controls">
          <div className="cmp-left">
            <button
              type="button"
              className={"cmp-auto" + (routingEnabled ? " on" : "")}
              role="switch"
              aria-checked={routingEnabled}
              data-testid="composer-auto"
              title={t("agents.composer.autoRoute")}
              onClick={() => setRoutingEnabled(!routingEnabled)}
            >
              <span className="cmp-auto-label">{t("agents.composer.auto")}</span>
              <span className="cmp-auto-track">
                <span className="cmp-auto-knob" />
              </span>
            </button>
            {!isChat && (
              <button
                type="button"
                className={"cmp-plan" + (planMode ? " active" : "")}
                data-testid="composer-plan"
                aria-pressed={planMode}
                title={t("agents.composer.planMode")}
                onClick={() => setPlanMode((v) => !v)}
              >
                <MessageSquare size={15} strokeWidth={1.6} />
              </button>
            )}
            {/* No model dropdown here: "Auto" is the routing control, not a model
                selector (token-economy definition). The effective model is the
                ModelBadge on the session tab; the override lives in
                Agent settings → Token economy. */}
          </div>
          <div className="cmp-right">
            <span className="cmp-ctx-wrap">
              <button
                type="button"
                className={"cmp-ico" + (panel === "tune" ? " active" : "")}
                data-testid="composer-tune"
                title={t("agents.composer.tune")}
                onClick={() => togglePanel("tune")}
              >
                <SlidersHorizontal size={15} strokeWidth={1.6} />
              </button>
              {panel === "tune" && (
                <>
                  <div className="menu-scrim" onClick={() => setPanel(null)} />
                  <div className="tune-pop cb-pop" data-testid="composer-tune-pop">
                    <div className="tune-sec">
                      <div className="ep-head">
                        <span className="ep-title">
                          {t("agents.composer.effort")}{" "}
                          <b>{(levels[effort] ?? levels[0]).label}</b>
                        </span>
                      </div>
                      <div className="ep-ends">
                        <span>{t("agents.composer.effortFaster")}</span>
                        <span>{t("agents.composer.effortSmarter")}</span>
                      </div>
                      <div
                        className="ep-slider"
                        data-testid="composer-effort-slider"
                        role="slider"
                        aria-label={t("agents.composer.effort")}
                        aria-valuenow={effort}
                        aria-valuemin={0}
                        aria-valuemax={levels.length - 1}
                      >
                        <div className="ep-track" />
                        {levels.map((_, i) => (
                          <button
                            type="button"
                            key={i}
                            className={
                              "ep-dot" +
                              (i === effort ? " thumb" : "") +
                              (i === levels.length - 1 ? " last" : "")
                            }
                            style={{ left: (i / (levels.length - 1)) * 100 + "%" }}
                            aria-label={levels[i].label}
                            onClick={() => setEffort(i)}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="tune-sec">
                      <div className="bp-head">
                        <span className="caps">{t("agents.composer.planUsage")}</span>
                      </div>
                      {plan.map((p) => (
                        <div key={p.id} className="bp-row" data-testid={`plan-row-${p.id}`}>
                          <div className="bp-line">
                            <span className="bp-label">{p.label}</span>
                            <span className="bp-right">{p.detail}</span>
                          </div>
                          <div className="bp-bar">
                            <div
                              className="bp-fill"
                              style={{ width: p.pct + "%", background: PLAN_COLOR[p.tone] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </span>
            <button
              type="button"
              className="cmp-ico"
              data-testid="composer-attach"
              title={t("agents.composer.attach")}
              aria-label={t("agents.composer.attach")}
              onClick={addFilesViaPicker}
            >
              <Paperclip size={15} strokeWidth={1.6} />
            </button>
            <button
              type="button"
              className={"cmp-send" + (running ? " sending" : "")}
              data-testid="composer-send"
              data-running={running || undefined}
              title={running ? t("agents.composer.stop") : t("agents.composer.send")}
              aria-label={running ? t("agents.composer.stop") : t("agents.composer.send")}
              onClick={send}
            >
              {running ? (
                <Square size={15} strokeWidth={2} />
              ) : (
                <ArrowUp size={15} strokeWidth={1.8} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="cmp-belowbar">
        {/* Branch-switcher (S8) — renders only once a checkpoint exists, so the
            below-bar is byte-identical at boot. */}
        <BranchSwitcher checkpoints={checkpoints} onJump={onJumpCheckpoint ?? (() => {})} />
        <span className="cmp-ctx-wrap">
          <button
            type="button"
            className={"cb-meter " + tone + (panel === "ctx" ? " active" : "")}
            data-testid="context-meter"
            data-tone={tone}
            title={t("agents.composer.contextMeter")}
            onClick={() => togglePanel("ctx")}
          >
            {tone === "crit" ? (
              <TriangleAlert size={13} color={toneColor} strokeWidth={1.8} />
            ) : (
              <Gauge size={13} color={toneColor} strokeWidth={1.8} />
            )}
            <span
              className="cb-meter-val"
              data-testid="context-meter-value"
              style={{ color: toneColor }}
            >
              {fmtK(used)}/{fmtK(budget)}
            </span>
            <span className="cb-meter-bar" data-testid="context-meter-bar">
              <span
                style={{ width: Math.min(100, ratio * 100) + "%", background: toneColor }}
              />
            </span>
          </button>
          {panel === "ctx" && (
            <>
              <div className="menu-scrim" onClick={() => setPanel(null)} />
              <div className="ctx-pop cb-pop" data-testid="context-meter-pop">
                <div className="bp-head">
                  <span className="caps">{t("agents.composer.contextBudget")}</span>
                  <span
                    className="ctx-pct"
                    data-testid="context-meter-pct"
                    style={{ color: toneColor }}
                  >
                    {Math.round(ratio * 100)}%
                  </span>
                </div>
                <div className="ctx-row">
                  {t("agents.composer.contextWarnAt", {
                    budget: fmtK(budget),
                    used: fmtK(used),
                  })}
                </div>
                <input
                  type="range"
                  className="ctx-range"
                  data-testid="context-budget-slider"
                  aria-label={t("agents.composer.contextBudget")}
                  min={50000}
                  max={400000}
                  step={10000}
                  value={budget}
                  onChange={(e) => setBudget(+e.target.value)}
                  style={{
                    background: `linear-gradient(90deg, var(--ds-accent) 0 ${fillPct}%, var(--ds-bg-raised) ${fillPct}% 100%)`,
                    height: "4px",
                    borderRadius: "999px",
                  }}
                />
                <div className="ctx-presets">
                  {presets.map((v) => (
                    <button
                      type="button"
                      key={v}
                      className={"ctx-preset" + (budget === v ? " active" : "")}
                      data-testid={`context-budget-preset-${v}`}
                      aria-pressed={budget === v}
                      onClick={() => setBudget(v)}
                    >
                      {fmtK(v)}
                    </button>
                  ))}
                </div>
                <div className="ctx-note">{t("agents.composer.contextNote")}</div>
              </div>
            </>
          )}
        </span>
        <span className="cmp-statline" data-testid="composer-status">
          {statusText}
        </span>
      </div>
    </>
  );
}
