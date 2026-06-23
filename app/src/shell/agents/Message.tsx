import * as React from "react";
import { useTranslation } from "react-i18next";
import { Copy, GitBranch, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Message as MessageData, MessageCell, MessageTable } from "@/contracts";

const TONE_TEXT: Record<NonNullable<MessageCell["tone"]>, string> = {
  ok: "text-success",
  bad: "text-destructive",
  warn: "text-warning",
};

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
    <div
      className={cn(
        "group relative",
        // Message surfaces (design-sync-v2 §3): agent = raised bordered card;
        // user = teal left strip. Right padding reserves the hover-action lane.
        isUser
          ? "border-l-2 border-primary/40 py-1 pl-3.5 pr-[70px]"
          : "rounded-md border border-border bg-card/40 px-3.5 py-3 pr-[70px]",
      )}
      data-testid={`msg-${msg.id}`}
      data-role={msg.role}
    >
      <div
        className={cn(
          "mb-1 text-[10.5px] font-semibold uppercase tracking-wide",
          isUser ? "text-primary" : "text-muted-foreground",
        )}
      >
        {who}
      </div>
      <div className="text-ui leading-relaxed text-foreground">{renderInline(msg.body)}</div>
      {msg.table && <MessageTableView table={msg.table} />}
      {msg.cards && msg.cards.length > 0 && (
        // Bleed right into the action-icon reserve (~56px) for full box width.
        <div className="-mr-14 mt-2.5 grid grid-cols-3 gap-2" data-testid={`msg-cards-${msg.id}`}>
          {msg.cards.map((c, i) => (
            <div key={i} className="rounded-sm border border-border bg-card px-2.5 py-2">
              <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{c.k}</div>
              <div
                className={cn(
                  "mt-0.5 font-mono text-[19px] font-semibold",
                  c.tone ? TONE_TEXT[c.tone] : "text-foreground",
                )}
              >
                {c.v}
              </div>
              {c.s && <div className="text-[10.5px] text-muted-foreground">{c.s}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="absolute right-2.5 top-2.5 hidden gap-2.5 group-hover:flex group-focus-within:flex">
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

/**
 * Full-box-width transcript table (design-sync-v2 §3). Bleeds right into the
 * hover-action reserve (~56px) so it uses the whole reading column. Scorecard
 * mode right-aligns + monospaces the numeric columns and emphasises the footer.
 */
function MessageTableView({ table }: { table: MessageTable }) {
  const numericCol = (i: number) => table.scorecard && i > 0;
  const cellCls = (c: MessageCell, i: number) =>
    cn(
      "border-b border-border px-2.5 py-1.5",
      numericCol(i) ? "text-right font-mono" : "text-left",
      c.tone ? TONE_TEXT[c.tone] : "text-muted-foreground",
    );
  return (
    <div className="-mr-14 mt-2.5 overflow-hidden rounded-sm border border-border">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  "border-b border-border bg-card px-2.5 py-1.5 font-semibold text-foreground",
                  numericCol(i) ? "text-right font-mono" : "text-left",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (
                <td key={i} className={cellCls(c, i)}>
                  {c.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {table.foot && (
          <tfoot>
            <tr>
              {table.foot.map((c, i) => (
                <td
                  key={i}
                  className={cn(
                    "border-t border-border-strong bg-card px-2.5 py-1.5 font-semibold",
                    numericCol(i) ? "text-right font-mono" : "text-left",
                    c.tone ? TONE_TEXT[c.tone] : "text-foreground",
                  )}
                >
                  {c.text}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
