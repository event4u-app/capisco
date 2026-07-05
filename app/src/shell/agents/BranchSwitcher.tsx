import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";

import type { CheckpointEntry } from "./store";

/**
 * Checkpoint / branch switcher (Agent-Cockpit P5-A / S8). A compact control in
 * the composer's below-bar that lists the session's named checkpoints; picking
 * one jumps to that divergent prompt line (the caller forks from its leaf via
 * `SessionTree.branch()`, the same non-destructive retry-as-branch primitive
 * Edit-&-Rerun uses).
 *
 * Renders NOTHING until at least one checkpoint exists — so it is invisible at
 * boot and the composer goldens stay byte-identical. Checkpoints are created
 * out-of-band via the "Checkpoint" command-palette action (escalation ladder),
 * never a boot-visible button.
 */
export function BranchSwitcher({
  checkpoints,
  onJump,
}: {
  checkpoints: CheckpointEntry[];
  onJump: (entry: CheckpointEntry) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  if (checkpoints.length === 0) {
    return null; // boot-invisible → golden-safe
  }

  return (
    <span className="cmp-ctx-wrap">
      <button
        type="button"
        className={"cmp-branch" + (open ? " active" : "")}
        data-testid="branch-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        title={t("agents.composer.branches", { count: checkpoints.length })}
        onClick={() => setOpen((o) => !o)}
      >
        <GitBranch size={13} strokeWidth={1.8} />
        <span className="cmp-branch-count">{checkpoints.length}</span>
      </button>
      {open && (
        <>
          <div className="menu-scrim" onClick={() => setOpen(false)} />
          <div className="branch-pop cb-pop" data-testid="branch-pop" role="menu">
            <div className="bp-head">
              <span className="caps">{t("agents.composer.branchesTitle")}</span>
            </div>
            {checkpoints.map((cp) => (
              <button
                type="button"
                key={cp.id}
                role="menuitem"
                className="branch-item"
                data-testid={`branch-item-${cp.id}`}
                onClick={() => {
                  onJump(cp);
                  setOpen(false);
                }}
              >
                <GitBranch size={12} strokeWidth={1.8} />
                {cp.label}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
