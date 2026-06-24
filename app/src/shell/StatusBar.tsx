import { Check, GitBranch } from "lucide-react";

/**
 * Status bar — 1:1 port of the prototype `StatusBar` (chrome.jsx). Markup +
 * classes (`.statusbar`, `.sb-crumb`, `.sb-item`, `.up`, `.sb-brand`) verbatim;
 * styling in capisco-composer.css. The `status-bar` testid is preserved.
 */
export function StatusBar() {
  return (
    <footer className="statusbar" data-testid="status-bar">
      <span className="sb-crumb">capisco › src › core › broker.ts</span>
      <div className="tb-spacer" />
      <span className="sb-item">TypeScript 6.0</span>
      <span className="sb-item" title="branch · sync">
        <GitBranch size={12} strokeWidth={1.6} />
        feat/worktree-teardown <span className="up">↑2</span>
      </span>
      <span className="sb-item" title="blame">
        Blame: matze 2d ago
      </span>
      <span className="sb-item">Ln 24, Col 8</span>
      <span className="sb-item">LF</span>
      <span className="sb-item">UTF-8</span>
      <span className="sb-item sb-brand">
        <Check size={12} color="var(--ds-accent)" strokeWidth={2} />
        capisco
      </span>
    </footer>
  );
}
