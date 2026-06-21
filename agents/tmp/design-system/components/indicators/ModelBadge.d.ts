import * as React from 'react';

/** Tiny monochrome label naming the model behind a session (Claude, GPT-5, Local). */
export interface ModelBadgeProps {
  children?: React.ReactNode;
  /** @default 'neutral' */
  tone?: 'neutral' | 'accent';
  style?: React.CSSProperties;
}

export function ModelBadge(props: ModelBadgeProps): React.JSX.Element;
