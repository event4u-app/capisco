import * as React from 'react';

/**
 * Square monochrome icon control for toolbars, activity bars and panel headers.
 * `active` renders the JetBrains selected look: accent tint + edge strip.
 */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Icon node — an <i data-lucide> element, an <svg>, or a glyph. */
  icon?: React.ReactNode;
  /** Selected/active state (lighter bg + teal edge strip). @default false */
  active?: boolean;
  /** Which edge the active accent strip sits on. @default 'left' */
  edge?: 'left' | 'right';
  /** Square size in px. @default 28 */
  size?: number;
  title?: string;
  disabled?: boolean;
}

export function IconButton(props: IconButtonProps): React.JSX.Element;
