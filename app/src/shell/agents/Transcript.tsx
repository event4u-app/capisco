import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolAction } from "@/components/capisco/tool-action";
import { PermissionPrompt } from "@/components/capisco/permission-prompt";
import { VirtualTranscript } from "@/components/ui/virtual-transcript";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { agentSnapshot } from "@/mocks";
import type { PermissionRequest, Session, TranscriptBlock } from "@/contracts";
import { Message } from "./Message";
import type { RunState } from "./store";
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
  session,
  runState,
  onRetry,
  onOpenFile,
}: {
  session: Session;
  runState: RunState;
  onRetry: () => void;
  onOpenFile: (file: string) => void;
}) {
  const blocks = agentSnapshot.blocks(session.id);
  // LIVE gate: the active session's parked `ask` over the sidecar bridge. Inert
  // (null) with no bridge — the snapshot path below is then byte-identical.
  const live = useLivePermission(session.id);

  if (runState === "loading") return <Wrap>{<LoadingState />}</Wrap>;
  if (runState === "error") return <Wrap>{<ErrorState onRetry={onRetry} />}</Wrap>;

  // The live pending prompt is an overlay above the transcript content. It only
  // renders when a real bridge has parked an `ask` for this session; otherwise
  // `live.pending` is null and the rendered tree is exactly the snapshot path.
  const liveBanner = live.pending ? (
    <LivePermissionBanner request={live.pending} onGrant={live.resolve} />
  ) : null;

  if (blocks.length === 0) {
    // No live banner → byte-identical to the original snapshot path.
    if (!liveBanner) return <Wrap>{<EmptyState model={session.model} />}</Wrap>;
    return (
      <Wrap>
        {liveBanner}
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
