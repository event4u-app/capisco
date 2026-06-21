import type {
  BlameLine,
  ChangeBar,
  CompletionItem,
  EditorDoc,
  EditorProvider,
  FoldRange,
  InlayHint,
  PresenceMarker,
} from "@/contracts";

/**
 * Deterministic editor PROVIDER-OUTPUT mock (build-spec §7 / editor.jsx).
 * Council-P1: the doc text is what CodeMirror indexes; everything else
 * (completions, hints, blame, presence, folds, change bars) is mock-provider
 * data laid over it — never derived from CodeMirror. No Date.now / Math.random.
 */

// The signature broker.ts source from the prototype, verbatim (1-based lines).
const BROKER_SRC = `// capability broker — grants scoped access to agent principals

import { Capability, Principal, Scope } from "./types";

export class Broker {
  private grants = new Map<string, Scope>();

  constructor(private registry: Registry) {}

  async checkCapability(
    principal: Principal,
    capability: Capability,
    scope: Scope = "once",
  ): Promise<boolean> {
    const key = \`\${principal.id}:\${capability.name}\`;

    if (this.grants.get(key) === "session") return true;

    const granted = await this.prompt(principal, capability);
    if (granted) this.grants.set(key, scope);
    return granted;
  }
}
`;

const WORKTREE_SRC = `// worktree — isolated git worktree + runtime per task

import { rm } from "node:fs/promises";

export class Worktree {
  constructor(
    private dir: string,
    private broker: Broker,
    private port: number,
  ) {}

  async dispose() {
    this.watcher.close();
    await this.teardown();
  }

  async teardown() {
    await this.broker.release(this.port);
    await rm(this.dir, { recursive: true });
  }
}
`;

const TYPES_SRC = `// shared capability-broker types

export interface Principal {
  id: string;
  kind: "human" | "agent";
}

export interface Capability {
  name: string;
}

export type Scope = "once" | "session";
`;

const DOCS: EditorDoc[] = [
  { file: "broker.ts", ext: "ts", text: BROKER_SRC, pinned: true },
  { file: "worktree.ts", ext: "ts", text: WORKTREE_SRC, dirty: true },
  { file: "types.ts", ext: "ts", text: TYPES_SRC },
];

// Completions surfaced at the broker.prompt(...) call site (editor.jsx Autocomplete).
const BROKER_COMPLETIONS: CompletionItem[] = [
  { label: "prompt", kind: "method", detail: "(p, c): Promise<boolean>" },
  { label: "promptUser", kind: "method", detail: "(msg): Promise<boolean>" },
  { label: "grants", kind: "field", detail: "Map<string, Scope>" },
  { label: "registry", kind: "property", detail: "Registry" },
  { label: "revoke", kind: "method", detail: "(key): void" },
];

// Parameter-name inlay hints before call arguments (editor.jsx <Inlay>).
const BROKER_HINTS: InlayHint[] = [
  { line: 16, col: 21, label: "key:" },
  { line: 18, col: 33, label: "principal:" },
  { line: 18, col: 44, label: "capability:" },
  { line: 19, col: 33, label: "key:" },
  { line: 19, col: 39, label: "value:" },
];

// Inline blame on the active line (editor.jsx Line 18 blame).
const BROKER_BLAME: BlameLine[] = [
  {
    line: 18,
    author: "matze",
    date: "28 Nov 2025",
    commit: "8f2a1c4",
    summary: "feat: add worktree teardown",
  },
];

// Colleague presence over lines 16–17 (editor.jsx pres-bar + line-presence).
const BROKER_PRESENCE: PresenceMarker[] = [
  {
    who: "mara",
    init: "ma",
    branch: "feat/capability-cache",
    pr: "#1283",
    when: "2m ago",
    fromLine: 16,
    toLine: 17,
    diff: [
      { sign: "−", line: 16, text: '  if (this.grants.get(key) === "session") return true;' },
      { sign: "+", line: 16, text: "  if (this.cache.has(key)) return this.cache.get(key);" },
      { sign: "+", line: 17, text: '  const hit = this.grants.get(key) === "session";' },
    ],
  },
];

// Git change bars in the gutter (editor.jsx git="add"/"mod").
const BROKER_BARS: ChangeBar[] = [
  { line: 1, kind: "A" },
  { line: 5, kind: "A" },
  { line: 10, kind: "A" },
  { line: 11, kind: "A" },
  { line: 12, kind: "A" },
  { line: 13, kind: "A" },
  { line: 18, kind: "M" },
];

// Foldable ranges (class body + method bodies) — LSP-style output.
const BROKER_FOLDS: FoldRange[] = [
  { fromLine: 5, toLine: 22 }, // class Broker { … }
  { fromLine: 10, toLine: 21 }, // checkCapability(…) { … }
];

const EMPTY_BARS: ChangeBar[] = [];

export const mockEditorProvider: EditorProvider = {
  getDocs: () => DOCS,
  getDoc: (file) => DOCS.find((d) => d.file === file),
  getCompletions: (file) => (file === "broker.ts" ? BROKER_COMPLETIONS : []),
  getInlayHints: (file) => (file === "broker.ts" ? BROKER_HINTS : []),
  getBlame: (file) => (file === "broker.ts" ? BROKER_BLAME : []),
  getPresence: (file) => (file === "broker.ts" ? BROKER_PRESENCE : []),
  getFolds: (file) => (file === "broker.ts" ? BROKER_FOLDS : []),
  getChangeBars: (file) =>
    file === "broker.ts"
      ? BROKER_BARS
      : file === "worktree.ts"
        ? [
            { line: 14, kind: "A" },
            { line: 15, kind: "A" },
            { line: 18, kind: "A" },
            { line: 19, kind: "A" },
            { line: 20, kind: "A" },
          ]
        : EMPTY_BARS,
  getActiveLine: (file) => (file === "broker.ts" ? 18 : 1),
};
