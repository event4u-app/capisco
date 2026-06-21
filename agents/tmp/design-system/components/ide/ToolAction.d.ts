import * as React from 'react';

/** A tool invocation surfaced inside a session transcript (edit, read, command). */
export interface ToolActionProps {
  /** Action verb. @default 'Edit' */
  kind?: string;
  /** Target path / argument (rendered monospace). */
  target?: string;
  /** Lines added (green +N). */
  added?: number;
  /** Lines removed (red −N). */
  removed?: number;
  /** Expanded to show children (diff / output). @default false */
  expanded?: boolean;
  onToggle?: () => void;
  /** When set, renders an "open in editor" icon on the right that calls this. */
  onOpen?: () => void;
  /** Body shown when expanded. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function ToolAction(props: ToolActionProps): React.JSX.Element;
