import * as React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolAction } from "@/components/capisco/tool-action";
import { PermissionPrompt } from "@/components/capisco/permission-prompt";
import { VirtualTranscript } from "@/components/ui/virtual-transcript";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { agentSnapshot, chatSnapshot } from "@/mocks";
import { getProviders, isDesktop } from "@/lib/desktop-shell";
import type { PermissionRequest, Session, TranscriptBlock } from "@/contracts";
import { Message } from "./Message";
import type { RunState, WorkspaceKind } from "./store";
import { useLivePermission } from "./use-live-permission";

/**
 * Live transcript blocks for a bridge-connected agents session. Loads
 * `getBlocks` once (keyed on the session id) and re-fetches on every stream
 * event from `subscribe`, unsubscribing on cleanup. Returns `null` when the
 * argument is `null` (no bridge / chat) — the caller then uses the snapshot
 * path, so the no-bridge render is byte-identical to before.
 */
function useLiveBlocks(sessionId: string | null): TranscriptBlock[] | null {
  // Keyed by sessionId so a session switch starts from `null` (snapshot
  // fallback) without a synchronous reset inside the effect.
  const [state, setState] = React.useState<{ id: string | null; blocks: TranscriptBlock[] | null }>(
    { id: sessionId, blocks: null },
  );
  React.useEffect(() => {
    if (sessionId == null) return;
    const agent = getProviders().agent;
    // Defensive: a bridge whose agent provider does not implement the live
    // block surface (getBlocks / subscribe) falls back to the snapshot path.
    if (typeof agent.getBlocks !== "function" || typeof agent.subscribe !== "function") {
      return;
    }
    let alive = true;
    const load = () => {
      void agent.getBlocks(sessionId).then((b) => {
        if (alive) setState({ id: sessionId, blocks: b });
      });
    };
    load();
    const unsubscribe = agent.subscribe(sessionId, load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [sessionId]);
  // Only surface live blocks for the CURRENT session id; a stale id (mid-switch)
  // or no bridge → null, so the caller uses the snapshot path.
  if (sessionId == null || state.id !== sessionId) return null;
  return state.blocks;
}

function EmptyState({ model }: { model: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="transcript-empty"
      className="flex h-full flex-col items-center justify-center gap-1.5 p-10 text-center"
    >
      <Sparkles className="size-6 text-muted-foreground" strokeWidth={1.6} aria-hidden />
      <div className="text-ui font-semibold text-muted-foreground">
        {t("agents.empty.title", { model })}
      </div>
      <div className="text-micro text-muted-foreground">{t("agents.empty.sub")}</div>
    </div>
  );
}

/**
 * The compressed carry-over summary a Red→new-session handoff seeds (Phase 1).
 * Rendered above the empty state so the human sees what context was carried.
 */
function HandoffSeed({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="handoff-seed"
      className="mx-auto mt-4 max-w-[740px] rounded-md border border-border bg-muted/40 px-4 py-3"
    >
      <div className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-muted-foreground">
        {t("agents.handoff.label")}
      </div>
      <div className="whitespace-pre-wrap font-mono text-micro text-muted-foreground">
        {text}
      </div>
    </div>
  );
}

function LoadingState() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  return (
    <div
      data-testid="transcript-loading"
      className="flex h-full flex-col items-center justify-center gap-1.5 p-10 text-center"
      role="status"
    >
      <Loader2
        className={cn("size-6 text-primary", !reduced && "animate-spin")}
        strokeWidth={1.6}
        aria-hidden
      />
      <div className="text-ui font-semibold text-foreground">{t("agents.loading.title")}</div>
      <div className="text-micro text-muted-foreground">{t("agents.loading.sub")}</div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="transcript-error"
      className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center"
      role="alert"
    >
      <AlertTriangle className="size-6 text-destructive" strokeWidth={1.6} aria-hidden />
      <div className="text-ui font-semibold text-foreground">{t("agents.error.title")}</div>
      <div className="max-w-xs text-micro text-muted-foreground">{t("agents.error.sub")}</div>
      <Button size="sm" variant="outline" onClick={onRetry} data-testid="transcript-retry">
        {t("agents.error.retry")}
      </Button>
    </div>
  );
}

function Block({
  block,
  onOpenFile,
  onRevertPath,
}: {
  block: TranscriptBlock;
  onOpenFile: (file: string) => void;
  onRevertPath?: (path: string) => void;
}) {
  const { t } = useTranslation();
  if (block.type === "message") return <Message msg={block.block} />;
  if (block.type === "tool") {
    const tool = block.block;
    return (
      <ToolAction
        kind={tool.kind}
        target={tool.target}
        added={tool.added}
        removed={tool.removed}
        onOpenInEditor={tool.openTarget ? () => onOpenFile(tool.openTarget!) : undefined}
        // Revert glyph on code-changing actions (matches the prototype). The
        // handler runs the broker-gated, git-authoritative worktree hunk-revert
        // (road-to-composer-context-runtime P4) — `revert.revertPath`, which is
        // honestly `skipped` without a worktree. The label stays "Discard code
        // change", never "undo" (Overview §2.3).
        onRevert={
          tool.added != null || tool.removed != null
            ? () => onRevertPath?.(tool.target)
            : undefined
        }
      >
        {tool.diff?.map((line, i) => (
          // Rich diff row (design-sync-v2 §3): line-number gutter + +/− sign
          // column + tinted background, replacing the flat coloured line.
          <div
            key={i}
            data-testid="diff-line"
            data-kind={line.kind}
            className={cn(
              "-mx-2 flex whitespace-pre text-code",
              line.kind === "add" && "bg-success/10",
              line.kind === "del" && "bg-destructive/10",
            )}
          >
            <span className="w-9 shrink-0 select-none pr-2.5 text-right text-muted-foreground">
              {line.lineNo ?? ""}
            </span>
            <span
              className={cn(
                "w-3.5 shrink-0 select-none text-center",
                line.kind === "add" && "text-success",
                line.kind === "del" && "text-destructive",
                line.kind === "ctx" && "text-muted-foreground",
              )}
            >
              {line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}
            </span>
            <span
              className={cn(
                "flex-1",
                line.kind === "ctx" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
      </ToolAction>
    );
  }
  // permission
  const p = block.block;
  return (
    <PermissionPrompt
      command={p.command}
      label={t("agents.permission.label")}
      scopes={p.scopes}
      credentialRef={p.credentialRef}
      credentialNote={p.credentialRef ? t("agents.permission.credentialNote") : undefined}
      prodNote={t("agents.permission.prodNote")}
    />
  );
}

/**
 * Chat transcript — centered ~740px reading column (build-plan §3 correction),
 * virtualized so a 500-block session stays performant (Tischstakes). Curated
 * short sessions still flow through the same virtualizer for one code path.
 */
export function Transcript({
  kind = "agents",
  session,
  runState,
  onRetry,
  onOpenFile,
  onRevertPath,
  handoffSeed,
}: {
  kind?: WorkspaceKind;
  session: Session;
  runState: RunState;
  onRetry: () => void;
  onOpenFile: (file: string) => void;
  /** Broker-gated worktree hunk-revert for a code-changing tool block (P4). */
  onRevertPath?: (path: string) => void;
  /**
   * Compressed carry-over summary (Phase 1 handoff) for a freshly handed-off
   * session — rendered above the empty state so the new session is not a blank
   * restart. Undefined for every normal session (incl. the visual harness, which
   * never triggers a handoff → goldens byte-identical).
   */
  handoffSeed?: string;
}) {
  const isChat = kind === "chat";
  // Live gate: only an installed desktop bridge on the agents kind reads blocks
  // from the live AgentProvider (loaded async, re-fetched on each stream event).
  // With NO bridge (browser / visual harness / tests) — or chat — this is the
  // verbatim snapshot path below, byte-identical to before.
  const liveBlocks = useLiveBlocks(!isChat && isDesktop() ? session.id : null);
  const blocks =
    liveBlocks ?? (isChat ? chatSnapshot.blocks(session.id) : agentSnapshot.blocks(session.id));
  // LIVE gate: the active session's parked `ask` over the sidecar bridge. Inert
  // (null) with no bridge — the snapshot path below is then byte-identical.
  // Chat has no tools / permissions, so the live gate never applies.
  const live = useLivePermission(isChat ? "" : session.id);

  if (runState === "loading") return <Wrap>{<LoadingState />}</Wrap>;
  if (runState === "error") return <Wrap>{<ErrorState onRetry={onRetry} />}</Wrap>;

  // The live pending prompt is an overlay above the transcript content. It only
  // renders when a real bridge has parked an `ask` for this session; otherwise
  // `live.pending` is null and the rendered tree is exactly the snapshot path.
  const liveBanner = live.pending ? (
    <LivePermissionBanner request={live.pending} onGrant={live.resolve} />
  ) : null;

  if (blocks.length === 0) {
    // A handed-off session (Phase 1) carries a compressed seed — render it above
    // the empty state so the fresh session is not a blank restart. Only a real
    // handoff sets this; the snapshot/golden path never does.
    const seed = handoffSeed ? <HandoffSeed text={handoffSeed} /> : null;
    // No live banner + no seed → byte-identical to the original snapshot path.
    if (!liveBanner && !seed) return <Wrap>{<EmptyState model={session.model} />}</Wrap>;
    return (
      <Wrap>
        {liveBanner}
        {seed}
        <EmptyState model={session.model} />
      </Wrap>
    );
  }

  const list = (
    <VirtualTranscript
      testid="transcript"
      items={blocks}
      estimatedRowHeight={64}
      itemKey={(b) => b.block.id}
      className="h-full"
      // The centered 740px reading column lives on the inner wrapper; the
      // scroll container is full-width so the scrollbar hugs the edge.
      renderRow={(b) => (
        <div className="mx-auto max-w-[740px] px-6 py-[9px]">
          <Block block={b} onOpenFile={onOpenFile} onRevertPath={onRevertPath} />
        </div>
      )}
      style={{ height: "100%" }}
    />
  );

  // No live banner → return the ORIGINAL list unchanged (snapshot/golden path is
  // byte-identical). Only a live, bridge-parked `ask` adds the wrapping column.
  if (!liveBanner) return list;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {liveBanner}
      <div className="min-h-0 flex-1">{list}</div>
    </div>
  );
}

/**
 * The LIVE pending permission prompt — a thin wrapper over {@link PermissionPrompt}
 * that wires `onGrant` to the live resolver. Rendered only when a bridge-connected
 * session has parked an `ask`; the snapshot/golden path never reaches it.
 */
function LivePermissionBanner({
  request,
  onGrant,
}: {
  request: PermissionRequest;
  onGrant: (scope: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-b border-border bg-editor" data-testid="live-permission">
      <div className="mx-auto max-w-[740px] px-6 py-3">
        <PermissionPrompt
          command={request.command}
          label={t("agents.permission.label")}
          scopes={request.scopes}
          credentialRef={request.credentialRef}
          credentialNote={
            request.credentialRef ? t("agents.permission.credentialNote") : undefined
          }
          prodNote={t("agents.permission.prodNote")}
          onGrant={onGrant}
        />
      </div>
    </div>
  );
}

/** Centered, scrollable wrapper for the non-list states. */
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="transcript">
      <div className="mx-auto h-full max-w-[740px] px-6">{children}</div>
    </div>
  );
}
