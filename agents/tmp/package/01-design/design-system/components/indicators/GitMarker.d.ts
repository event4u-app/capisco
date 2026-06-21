import * as React from 'react';

/** Single-letter VCS status glyph at the right edge of a changed file row. */
export interface GitMarkerProps {
  /** @default 'M' */
  status?: 'M' | 'A' | 'D' | 'U';
  style?: React.CSSProperties;
}

export function GitMarker(props: GitMarkerProps): React.JSX.Element;
