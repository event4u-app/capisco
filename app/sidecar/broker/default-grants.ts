/**
 * Conservative default grant configuration (B4 Phase 0, overview §4 human-gated).
 *
 * THIS IS CONFIG, NOT CODE. It is a human-authored, deliberately narrow
 * allowlist — the build does NOT invent a permissive default. The policy engine
 * reads this object; it never hard-codes verdicts. A deployment may extend it
 * (human edit), but autonomous widening is forbidden.
 *
 * Design (concept §3.1, mirroring Claude's permission model — `Bash(git
 * status:*)` allow, `Bash(rm:*)` ask):
 *  - Read-only / status / introspection → `allow` (safe, idempotent).
 *  - Everything mutating (write, commit, network, db-write) → `ask` (default
 *    is ask, never permanent — §4).
 *  - Known-dangerous (`rm`, force-push, prod db-write) → `deny` or `ask`,
 *    never `allow`.
 *
 * The list is intentionally short. Absence of a matching rule defaults to
 * `ask` in the engine — fail-closed, not fail-open.
 */

import type { GrantConfig } from "@/contracts";

export const DEFAULT_GRANT_CONFIG: GrantConfig = {
  rules: [
    // --- shell: read-only git/status commands are safe; mutating ones ask ---
    { kind: "shell", pattern: "git status*", verdict: "allow" },
    { kind: "shell", pattern: "git log*", verdict: "allow" },
    { kind: "shell", pattern: "git diff*", verdict: "allow" },
    { kind: "shell", pattern: "git branch*", verdict: "allow" },
    { kind: "shell", pattern: "git show*", verdict: "allow" },
    { kind: "shell", pattern: "ls*", verdict: "allow" },
    { kind: "shell", pattern: "cat*", verdict: "ask" },
    { kind: "shell", pattern: "git commit*", verdict: "ask" },
    { kind: "shell", pattern: "git push*", verdict: "ask" },
    // Agent-tooling installs (B8) are consequential shell egress — ALWAYS ask,
    // never auto. The IDE surfaces the exact command + a human gate; the build
    // never widens these to `allow`. A `sudo`-prefixed install still hits the
    // deny rule below.
    { kind: "shell", pattern: "npm i*", verdict: "ask" },
    { kind: "shell", pattern: "npm install*", verdict: "ask" },
    { kind: "shell", pattern: "npx*", verdict: "ask" },
    // Destructive shell is denied outright in the default config — never allow.
    { kind: "shell", pattern: "rm*", verdict: "deny" },
    { kind: "shell", pattern: "sudo*", verdict: "deny" },

    // --- file: reads are allowed within the workspace; writes ask ---
    { kind: "file-read", pattern: "*", verdict: "allow" },
    { kind: "file-write", pattern: "*", verdict: "ask" },

    // --- network: any outbound asks (egress is sensitive) ---
    { kind: "network", pattern: "*", verdict: "ask" },

    // --- db: reads allowed; writes ask (prod write is blocked by invariant) ---
    { kind: "db-read", pattern: "*", verdict: "allow" },
    { kind: "db-write", pattern: "*", verdict: "ask" },

    // --- secrets + external write-back always ask (human-gated) ---
    { kind: "secret-read", pattern: "*", verdict: "ask" },
    { kind: "external-write", pattern: "*", verdict: "ask" },
  ],
};
