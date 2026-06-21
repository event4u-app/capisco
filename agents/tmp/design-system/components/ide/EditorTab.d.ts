import * as React from 'react';

/** One tab in the editor tab strip. */
export interface EditorTabProps {
  /** Type icon node (left of the label). */
  icon?: React.ReactNode;
  label?: string;
  /** Active tab merges with the editor + gets a top teal strip. @default false */
  active?: boolean;
  /** Pinned tabs show a pin glyph instead of the hover close. @default false */
  pinned?: boolean;
  /** Unsaved indicator dot (when not hovered/pinned). @default false */
  dirty?: boolean;
  onSelect?: () => void;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export function EditorTab(props: EditorTabProps): React.JSX.Element;
