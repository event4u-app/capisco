import * as React from "react";
import { useTranslation } from "react-i18next";
import { Image, Download, Maximize2, Bookmark } from "lucide-react";
import { Icon } from "@/components/icon";

export interface ChartCardProps {
  title: string;
  children: React.ReactNode;
  testid?: string;
}

/**
 * Card shell with the reference toolbar (image / download / expand / bookmark)
 * from the prototype charts.jsx ChartCard. The toolbar buttons are decorative
 * affordances (no behaviour wired yet) but keyboard-focusable + labelled.
 */
export function ChartCard({ title, children, testid }: ChartCardProps) {
  const { t } = useTranslation();
  const tools: { icon: typeof Image; key: string }[] = [
    { icon: Image, key: "image" },
    { icon: Download, key: "download" },
    { icon: Maximize2, key: "expand" },
    { icon: Bookmark, key: "bookmark" },
  ];
  return (
    <div
      data-testid={testid ?? `chart-card-${title}`}
      className="flex flex-col rounded-md border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-ui font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {tools.map(({ icon, key }) => (
            <button
              key={key}
              type="button"
              aria-label={t(`chart.tool.${key}`)}
              title={t(`chart.tool.${key}`)}
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Icon icon={icon} size={14} />
            </button>
          ))}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
