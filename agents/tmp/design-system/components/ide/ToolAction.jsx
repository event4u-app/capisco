import React from 'react';

/**
 * Capisco ToolAction — a single tool invocation surfaced inside a session
 * transcript, e.g. an edit, a file read, a command. Collapsible header row
 * with a name, a target path (mono), and an optional +adds / −dels diffstat.
 */
export function ToolAction({
  kind = 'Edit',
  target,
  added,
  removed,
  expanded = false,
  onToggle,
  onOpen,
  children,
  style = {},
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-1)',
        background: 'var(--bg-raised)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        onClick={onToggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          height: '26px',
          padding: '0 8px',
          cursor: onToggle ? 'pointer' : 'default',
          background: hover && onToggle ? 'var(--bg-hover)' : 'transparent',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--fs-small)',
        }}
      >
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--dur-fast) var(--ease-standard)',
          }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-medium)' }}>{kind}</span>
        {target && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
          }}>
            {target}
          </span>
        )}
        {(added != null || removed != null) && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', flexShrink: 0, display: 'inline-flex', gap: '6px' }}>
            {added != null && <span style={{ color: 'var(--success)' }}>+{added}</span>}
            {removed != null && <span style={{ color: 'var(--error)' }}>−{removed}</span>}
          </span>
        )}
        {onOpen && (
          <button
            type="button"
            title="Open in editor"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '20px', height: '20px', padding: 0, marginLeft: '2px', flexShrink: 0,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: hover ? 'var(--accent)' : 'var(--text-tertiary)',
              transition: 'color var(--dur-fast) var(--ease-standard)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </button>
        )}
      </div>
      {expanded && children && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 'var(--lh-code)', color: 'var(--text-secondary)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
