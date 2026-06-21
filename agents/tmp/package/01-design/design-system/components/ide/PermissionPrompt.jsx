import React from 'react';
import { Button } from '../core/Button.jsx';

/**
 * Capisco PermissionPrompt — the Capability-Broker approval block.
 * The signature Capisco moment: an agent requests a capability and the human
 * grants or denies scope. Teal-outlined, calm — never alarmist red.
 */
export function PermissionPrompt({
  command,
  label = 'Approval required',
  scopes = ['Once', 'This session', 'Deny'],
  onGrant,
  style = {},
}) {
  return (
    <div
      style={{
        border: '1px solid var(--accent-muted)',
        borderRadius: 'var(--radius-2)',
        background: 'var(--accent-tint)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--text-primary)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-1)',
            padding: '1px 6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {command}
        </code>
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {scopes.map((s, i) => (
          <Button
            key={s}
            variant={i === 0 ? 'primary' : i === scopes.length - 1 ? 'ghost' : 'default'}
            size="sm"
            onClick={() => onGrant && onGrant(s)}
          >
            {s}
          </Button>
        ))}
      </div>
    </div>
  );
}
