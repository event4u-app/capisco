import * as React from "react";
import { useTranslation } from "react-i18next";
import { Copy, GitBranch, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Message as MessageData } from "@/contracts";

/** Renders `inline code` spans (backtick-delimited) as mono chips. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={i}
          className="rounded-sm bg-muted px-1 font-mono text-[12.5px] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export function Message({ msg }: { msg: MessageData }) {
  const { t } = useTranslation();
  const isUser = msg.role === "user";
  const who = msg.who ?? (isUser ? t("agents.transcript.you") : t("agents.transcript.agent"));
  return (
    <div className="group relative pr-[70px]" data-testid={`msg-${msg.id}`} data-role={msg.role}>
      <div
        className={cn(
          "mb-1 text-[10.5px] font-semibold uppercase tracking-wide",
          isUser ? "text-primary" : "text-muted-foreground",
        )}
      >
        {who}
      </div>
      <div className="text-ui leading-relaxed text-foreground">{renderInline(msg.body)}</div>
      <div className="absolute right-0 top-0 hidden gap-2.5 group-hover:flex group-focus-within:flex">
        <button
          type="button"
          aria-label={t("agents.transcript.retry")}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          aria-label={t("agents.transcript.copy")}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Copy className="size-3.5" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          aria-label={t("agents.transcript.branch")}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <GitBranch className="size-3.5" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
