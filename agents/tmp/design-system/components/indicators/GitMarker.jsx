import React from 'react';

/**
 * Capisco GitMarker — single-letter VCS status glyph shown at the right edge
 * of a changed file row. Dezent: just the colored letter, no chip.
 * status: 'M' modified | 'A' added | 'D' deleted | 'U' untracked
 */
export function GitMarker({ status = 'M', style = {} }) {
  const colors = {
    M: 'var(--git-modified)',
    A: 'var(--git-added)',
    D: 'var(--git-deleted)',
    U: 'var(--git-untracked)',
  };
  return (
    <span
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '11px',
        fontWeight: 'var(--fw-semibold)',
        color: colors[status] || 'var(--text-secondary)',
        lineHeight: 1,
        ...style,
      }}
    >
      {status}
    </span>
  );
}
