import {
  Bell,
  Container,
  Database,
  FileDiff,
  Files,
  GitCommitVertical,
  GitCompare,
  GitPullRequest,
  ListChecks,
  ListTree,
  ScanSearch,
  Search,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";
import { TERMINAL_ID, type ToolId } from "./store";

export interface ToolDef {
  id: ToolId;
  icon: LucideIcon;
  labelKey: string;
}

/** Single source of truth for dockable tools — drives the rails, panel headers
 * and the command palette (chrome.jsx TOOLS). */
export const TOOLS: Record<ToolId, ToolDef> = {
  explorer: { id: "explorer", icon: Files, labelKey: "rail.explorer" },
  changes: { id: "changes", icon: FileDiff, labelKey: "rail.changes" },
  commit: { id: "commit", icon: GitCommitVertical, labelKey: "rail.commit" },
  pr: { id: "pr", icon: GitPullRequest, labelKey: "rail.pr" },
  tasks: { id: "tasks", icon: ListChecks, labelKey: "rail.tasks" },
  search: { id: "search", icon: Search, labelKey: "rail.search" },
  structure: { id: "structure", icon: ListTree, labelKey: "rail.structure" },
  data: { id: "data", icon: Database, labelKey: "rail.data" },
  services: { id: "services", icon: Container, labelKey: "rail.services" },
  alerts: { id: "alerts", icon: Bell, labelKey: "rail.alerts" },
  inspect: { id: "inspect", icon: ScanSearch, labelKey: "rail.inspect" },
};

export const TERMINAL_TOOL = {
  id: TERMINAL_ID,
  icon: SquareTerminal,
  labelKey: "rail.terminal",
};

/** Returns the icon + labelKey for any rail item, including the terminal. */
export function railItem(id: string): { icon: LucideIcon; labelKey: string } {
  if (id === TERMINAL_ID) return { icon: TERMINAL_TOOL.icon, labelKey: TERMINAL_TOOL.labelKey };
  const t = TOOLS[id as ToolId];
  return t ?? { icon: GitCompare, labelKey: id };
}
