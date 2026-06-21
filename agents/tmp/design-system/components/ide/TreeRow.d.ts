import * as React from 'react';

/** A single row in the file-explorer tree (or any tree). */
export interface TreeRowProps {
  /** Indentation level. @default 0 */
  depth?: number;
  /** Show an expand chevron (folders). @default false */
  expandable?: boolean;
  /** Chevron rotation / open state. @default false */
  expanded?: boolean;
  /** Type icon node. */
  icon?: React.ReactNode;
  label?: string;
  /** Active row: lighter bg + left teal strip. @default false */
  active?: boolean;
  /** Dim the row (e.g. git-ignored). @default false */
  muted?: boolean;
  /** Trailing slot — typically a <GitMarker/>. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function TreeRow(props: TreeRowProps): React.JSX.Element;
