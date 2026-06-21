import { FileCode2, FileJson, FileText, FileType2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/icon";

// Language tint pulls from the design tokens (CSS vars) — no hardcoded hex.
const BY_EXT: Record<string, { icon: LucideIcon; color: string }> = {
  ts: { icon: FileCode2, color: "var(--syn-function)" },
  tsx: { icon: FileCode2, color: "var(--syn-function)" },
  js: { icon: FileType2, color: "var(--warning)" },
  rs: { icon: FileCode2, color: "var(--git-deleted)" },
  json: { icon: FileJson, color: "var(--warning)" },
  md: { icon: FileText, color: "var(--text-secondary)" },
};

/** Per-extension file glyph for tabs/tree, monochrome-tinted by language. */
export function FileIcon({ ext }: { ext: string }) {
  const def = BY_EXT[ext] ?? { icon: FileText, color: "var(--text-secondary)" };
  return (
    <span style={{ color: def.color }} className="flex items-center">
      <Icon icon={def.icon} size={13} />
    </span>
  );
}
