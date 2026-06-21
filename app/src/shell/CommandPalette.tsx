import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Eye,
  EyeOff,
  FileCode2,
  FileDiff,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  Pin,
  PinOff,
  SquareKanban,
  SquareTerminal,
  SunMoon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useTheme } from "@/lib/theme";
import { TOOLS, railItem } from "./tools";
import { FLYOUT_TOOL_IDS, PRESETS, TOOL_IDS, useLayout, type WorkspaceMode } from "./store";
import { usePalette, type Command } from "./command-registry";

const MODE_ICONS: Record<Exclude<WorkspaceMode, "diff">, typeof Bot> = {
  agents: Bot,
  chat: MessageSquare,
  editor: FileCode2,
  git: GitBranch,
  tasks: SquareKanban,
};

export function CommandPalette() {
  const { t } = useTranslation();
  const open = usePalette((s) => s.open);
  const setOpen = usePalette((s) => s.setOpen);
  const registered = usePalette((s) => s.registered);

  const { toggle: toggleTheme } = useTheme();
  const setMode = useLayout((s) => s.setMode);
  const toggleTerminal = useLayout((s) => s.toggleTerminal);
  const select = useLayout((s) => s.select);
  const reorder = useLayout((s) => s.reorder);
  const groups = useLayout((s) => s.groups);
  const hiddenTools = useLayout((s) => s.hiddenTools);
  const applyPreset = useLayout((s) => s.applyPreset);
  const toggleToolVisibility = useLayout((s) => s.toggleToolVisibility);
  const togglePin = useLayout((s) => s.togglePin);
  const pinnedFlyouts = useLayout((s) => s.pinnedFlyouts);
  const rTopActive = useLayout((s) => s.rTopActive);
  const rBotActive = useLayout((s) => s.rBotActive);

  const allDockedTools = React.useMemo(
    () => [...groups.leftTop, ...groups.leftBottom, ...groups.rightTop, ...groups.rightBottom],
    [groups],
  );

  const builtins = React.useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Workspaces.
    (Object.keys(MODE_ICONS) as Exclude<WorkspaceMode, "diff">[]).forEach((m) => {
      cmds.push({
        id: `mode:${m}`,
        group: "modes",
        icon: MODE_ICONS[m],
        label: t("palette.switchMode", { mode: t(`mode.${m}`) }),
        run: () => setMode(m),
      });
    });

    // Tools — escalation ladder: hidden tools STAY findable here (§5.6.6 / §5.4).
    TOOL_IDS.forEach((id) => {
      const hidden = hiddenTools.includes(id);
      const docked = allDockedTools.includes(id);
      cmds.push({
        id: `tool:${id}`,
        group: "tools",
        icon: TOOLS[id].icon,
        keywords: hidden ? "hidden" : undefined,
        label: hidden
          ? t("palette.openToolHidden", { tool: t(railItem(id).labelKey) })
          : t("palette.openTool", { tool: t(railItem(id).labelKey) }),
        run: () => {
          // Showing a hidden tool first keeps "hidden ≠ disabled" honest.
          if (hidden) toggleToolVisibility(id);
          // Dock an un-docked tool into the left-top group so it has a home.
          if (!docked) reorder(id, "leftTop", null);
          select(id);
        },
      });
    });

    // View.
    cmds.push({
      id: "view:terminal",
      group: "view",
      icon: SquareTerminal,
      label: t("palette.toggleTerminal"),
      run: toggleTerminal,
    });
    cmds.push({
      id: "view:theme",
      group: "view",
      icon: SunMoon,
      label: t("palette.toggleTheme"),
      run: toggleTheme,
    });
    cmds.push({
      id: "view:diff",
      group: "view",
      icon: FileDiff,
      label: t("palette.openDiff"),
      run: () => setMode("diff"),
    });

    // Visibility toggles for every tool (§5.4).
    TOOL_IDS.forEach((id) => {
      const hidden = hiddenTools.includes(id);
      cmds.push({
        id: `vis:${id}`,
        group: "view",
        icon: hidden ? Eye : EyeOff,
        keywords: "visibility hide show",
        label: hidden
          ? t("palette.showTool", { tool: t(railItem(id).labelKey) })
          : t("palette.hideTool", { tool: t(railItem(id).labelKey) }),
        run: () => toggleToolVisibility(id),
      });
    });

    // Flyout pin toggles (§2): dock as a column vs float as an overlay.
    FLYOUT_TOOL_IDS.forEach((id) => {
      const pinned = pinnedFlyouts.includes(id);
      cmds.push({
        id: `pin:${id}`,
        group: "view",
        icon: pinned ? PinOff : Pin,
        keywords: "pin dock overlay flyout",
        label: pinned
          ? t("palette.unpinFlyout", { tool: t(railItem(id).labelKey) })
          : t("palette.pinFlyout", { tool: t(railItem(id).labelKey) }),
        run: () => {
          // Ensure the flyout is open (without toggling it shut) so the pin
          // state is observable.
          if (rTopActive !== id && rBotActive !== id) select(id);
          togglePin(id);
        },
      });
    });

    // Presets.
    PRESETS.forEach((p) => {
      cmds.push({
        id: `preset:${p.id}`,
        group: "presets",
        icon: LayoutGrid,
        label: t("palette.applyPreset", { preset: t(p.labelKey) }),
        run: () => applyPreset(p.id),
      });
    });

    return cmds;
  }, [
    t,
    setMode,
    toggleTerminal,
    toggleTheme,
    select,
    reorder,
    applyPreset,
    toggleToolVisibility,
    togglePin,
    pinnedFlyouts,
    rTopActive,
    rBotActive,
    hiddenTools,
    allDockedTools,
  ]);

  const commands = React.useMemo(
    () => [...builtins, ...Object.values(registered)],
    [builtins, registered],
  );

  const byGroup = (g: Command["group"]) => commands.filter((c) => c.group === g);

  const runAnd = (cmd: Command) => {
    cmd.run();
    setOpen(false);
  };

  const groupOrder: { key: Command["group"]; labelKey: string }[] = [
    { key: "modes", labelKey: "palette.groups.modes" },
    { key: "tools", labelKey: "palette.groups.tools" },
    { key: "view", labelKey: "palette.groups.view" },
    { key: "presets", labelKey: "palette.groups.presets" },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("palette.placeholder")} data-testid="palette-input" />
      <CommandList data-testid="palette-list">
        <CommandEmpty>{t("palette.empty")}</CommandEmpty>
        {groupOrder.map(({ key, labelKey }) => {
          const items = byGroup(key);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={key} heading={t(labelKey)}>
              {items.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.keywords ?? ""}`}
                  data-testid={`palette-cmd-${cmd.id}`}
                  onSelect={() => runAnd(cmd)}
                >
                  {cmd.icon && <cmd.icon className="size-4" strokeWidth={1.6} aria-hidden />}
                  <span>{cmd.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
