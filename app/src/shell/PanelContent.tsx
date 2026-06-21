import { useTranslation } from "react-i18next";
import { PackageOpen } from "lucide-react";
import { Icon } from "@/components/icon";
import { railItem } from "./tools";
import { ExplorerPanel } from "./panels/ExplorerPanel";
import { ChangesPanel } from "./panels/ChangesPanel";
import { CommitPanel } from "./panels/CommitPanel";
import { SearchPanel } from "./panels/SearchPanel";
import { StructurePanel } from "./panels/StructurePanel";
import { ServicesPanel } from "./panels/ServicesPanel";
import { DataPanel } from "./panels/DataPanel";
import { SignalFlyout } from "./signals/SignalFlyout";

/** Placeholder for tools whose full panels land in later roadmaps (R5–R6). */
function PanelPlaceholder({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="panel-placeholder"
      className="flex h-full flex-col items-center justify-center gap-1.5 text-muted-foreground"
    >
      <Icon icon={PackageOpen} size={24} className="text-muted-foreground" />
      <div className="text-ui text-foreground">{t(labelKey)}</div>
      <div className="text-micro">{t("panel.notWired")}</div>
    </div>
  );
}

/** Routes a docked tool id to its panel content. The R4 Git-Near provider views
 * (Explorer, Changes, Commit, Search, Structure) are wired; the rest carry the
 * honest "not wired in this shell" placeholder until their roadmap. */
export function PanelContent({ id }: { id: string }) {
  switch (id) {
    case "explorer":
      return <ExplorerPanel />;
    case "changes":
      return <ChangesPanel />;
    case "commit":
      return <CommitPanel />;
    case "search":
      return <SearchPanel />;
    case "structure":
      return <StructurePanel />;
    case "services":
      return <ServicesPanel />;
    case "data":
      return <DataPanel />;
    case "alerts":
      return <SignalFlyout channel="alerts" />;
    case "inspect":
      return <SignalFlyout channel="inspect" />;
    default:
      return <PanelPlaceholder labelKey={railItem(id).labelKey} />;
  }
}
