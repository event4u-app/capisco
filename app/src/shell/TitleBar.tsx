import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Ellipsis,
  GitBranch,
  Play,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { usePalette } from "./command-registry";
import { ProjectSwitcher } from "./ProjectSwitcher";

/**
 * Title bar — 1:1 port of the prototype `TitleBar` (chrome.jsx). Markup +
 * classes (`.titlebar`, `.tb-traffic`/`.tl`, `.tb-mark`, `.tb-chip`, `.tb-ico`)
 * are verbatim; styling lives in capisco-composer.css. App wiring (theme
 * toggle, command palette, ProjectSwitcher) + the `titlebar` testid preserved.
 */
export function TitleBar() {
  const { t } = useTranslation();
  const { toggle } = useTheme();
  const openPalette = usePalette((s) => s.toggle);
  return (
    <header className="titlebar" data-testid="titlebar">
      <div className="tb-traffic" aria-hidden>
        <span className="tl tl-r" />
        <span className="tl tl-y" />
        <span className="tl tl-g" />
      </div>
      <ProjectSwitcher current="capisco" />
      <button type="button" className="tb-chip tb-branch" title={t("titlebar.branch")}>
        <GitBranch size={13} strokeWidth={1.6} />
        main
        <ChevronDown size={13} strokeWidth={1.6} />
      </button>
      <div className="tb-spacer" />
      <button type="button" className="tb-ico" title={t("titlebar.run")} aria-label={t("titlebar.run")}>
        <Play size={15} strokeWidth={1.6} />
      </button>
      <button type="button" className="tb-chip tb-run" title={t("titlebar.runConfig")}>
        Dev
        <ChevronDown size={13} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className="tb-ico"
        title={t("titlebar.commandPalette")}
        aria-label={t("titlebar.commandPalette")}
        onClick={openPalette}
      >
        <Search size={15} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className="tb-ico"
        title={t("theme.toggle")}
        aria-label={t("theme.toggle")}
        onClick={toggle}
      >
        <Sun size={15} strokeWidth={1.6} />
      </button>
      <button type="button" className="tb-ico" title={t("titlebar.more")} aria-label={t("titlebar.more")}>
        <Ellipsis size={15} strokeWidth={1.6} />
      </button>
      <button
        type="button"
        className="tb-ico"
        title={t("titlebar.settings")}
        aria-label={t("titlebar.settings")}
      >
        <Settings size={15} strokeWidth={1.6} />
      </button>
    </header>
  );
}
