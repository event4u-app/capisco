import * as React from 'react';

/**
 * Session / process state indicator dot.
 * @startingPoint section="Indicators" subtitle="Running / idle / waiting status dot" viewport="700x150"
 */
export interface StatusDotProps {
  /** @default 'idle' */
  status?: 'running' | 'idle' | 'waiting' | 'error' | 'done';
  /** Diameter in px. @default 8 */
  size?: number;
  style?: React.CSSProperties;
}

export function StatusDot(props: StatusDotProps): React.JSX.Element;
