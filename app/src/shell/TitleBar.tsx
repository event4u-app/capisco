import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  GitBranch,
  MoreHorizontal,
  Play,
  Search,
  Settings,
  SunMoon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { usePalette } from "./command-registry";

function TrafficLights() {
  return (
    <div className="flex items-center gap-2 pl-1" aria-hidden>
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

function ChromeButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const { t } = useTranslation();
  const { toggle } = useTheme();
  const openPalette = usePalette((s) => s.toggle);
  return (
    <header
      data-testid="titlebar"
      className="flex h-10 items-center gap-2 border-b border-border bg-card px-2 text-ui"
    >
      <TrafficLights />
      <span className="ml-1 font-mono text-code font-semibold text-primary">capisco</span>
      <ChromeButton label={t("titlebar.project")}>
        capisco
        <ChevronDown className="size-3" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("titlebar.branch")}>
        <GitBranch className="size-3.5" strokeWidth={1.6} />
        main
        <ChevronDown className="size-3" strokeWidth={1.6} />
      </ChromeButton>
      <div className="flex-1" />
      <ChromeButton label={t("titlebar.run")}>
        <Play className="size-3.5" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("titlebar.runConfig")}>
        Dev
        <ChevronDown className="size-3" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("titlebar.commandPalette")} onClick={openPalette}>
        <Search className="size-3.5" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("theme.toggle")} onClick={toggle}>
        <SunMoon className="size-3.5" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("titlebar.more")}>
        <MoreHorizontal className="size-3.5" strokeWidth={1.6} />
      </ChromeButton>
      <ChromeButton label={t("titlebar.settings")}>
        <Settings className="size-3.5" strokeWidth={1.6} />
      </ChromeButton>
    </header>
  );
}
