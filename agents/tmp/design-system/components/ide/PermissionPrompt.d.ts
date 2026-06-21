import * as React from 'react';

/**
 * The Capability-Broker approval block — Capisco's signature interaction.
 * @startingPoint section="Agent" subtitle="Capability-broker permission prompt" viewport="700x180"
 */
export interface PermissionPromptProps {
  /** The requested capability, e.g. 'Bash(rm -rf .worktrees/tmp)'. */
  command?: string;
  /** Caption under the command. @default 'Approval required' */
  label?: string;
  /** Scope buttons, most-permissive first. @default ['Once','This session','Deny'] */
  scopes?: string[];
  /** Called with the chosen scope string. */
  onGrant?: (scope: string) => void;
  style?: React.CSSProperties;
}

export function PermissionPrompt(props: PermissionPromptProps): React.JSX.Element;
