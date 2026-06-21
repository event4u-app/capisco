import React from 'react';

/**
 * Capisco ModelBadge — tiny monochrome label naming the model behind a session.
 * Calm by default (gray, bordered). Set `tone="accent"` only to spotlight one.
 */
export function ModelBadge({ children, tone = 'neutral', style = {} }) {
  const tones = {
    neutral: { color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'transparent' },
    accent:  { color: 'var(--accent)', borderColor: 'var(--accent-muted)', background: 'var(--accent-tint)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '16px',
        padding: '0 5px',
        fontFamily: 'var(--font-sans)',
        fontSize: '10.5px',
        fontWeight: 'var(--fw-medium)',
        letterSpacing: '0.01em',
        borderRadius: 'var(--radius-1)',
        border: '1px solid',
        whiteSpace: 'nowrap',
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
