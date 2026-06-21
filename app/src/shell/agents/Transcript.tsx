import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolAction } from "@/components/capisco/tool-action";
import { PermissionPrompt } from "@/components/capisco/permission-prompt";
import { VirtualTranscript } from "@/components/ui/virtual-transcript";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { agentSnapshot, chatSnapshot } from "@/mocks";
import type { PermissionRequest, Session, TranscriptBlock } from "@/contracts";
import { Message } from "./Message";
import type { RunState, WorkspaceKind } from "./store";
import { useLivePermission } from "./use-live-permission";

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
      <div className="whitespace-pre-wrap font-mono text-micro text-muted-foreground">{text}</div>
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
}: {
  block: TranscriptBlock;
  onOpenFile: (file: string) => void;
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
      >
        {tool.diff?.map((line, i) => (
          <div
            key={i}
            className={cn(
              "text-code",
              line.kind === "add" && "text-success",
              line.kind === "del" && "text-destructive",
              line.kind === "ctx" && "text-muted-foreground",
            )}
          >
            {line.text}
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
  handoffSeed,
}: {
  kind?: WorkspaceKind;
  session: Session;
  runState: RunState;
  onRetry: () => void;
  onOpenFile: (file: string) => void;
  /**
   * Compressed carry-over summary (Phase 1 handoff) for a freshly handed-off
   * session — rendered above the empty state so the new session is not a blank
   * restart. Undefined for every normal session (incl. the visual harness, which
   * never triggers a handoff → goldens byte-identical).
   */
  handoffSeed?: string;
}) {
  const isChat = kind === "chat";
  const blocks = isChat ? chatSnapshot.blocks(session.id) : agentSnapshot.blocks(session.id);
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
          <Block block={b} onOpenFile={onOpenFile} />
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
          credentialNote={request.credentialRef ? t("agents.permission.credentialNote") : undefined}
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
