import React from 'react';

/**
 * Capisco EditorTab — one tab in the editor tab strip.
 * Active tab adopts the editor background (#1E1F22) so it "merges" with the
 * editor below, plus a 1px teal strip on top. Inactive tabs read gray.
 * Pinned tabs show a pin glyph instead of the hover close (x) and sit narrower.
 */
export function EditorTab({
  icon,
  label,
  active = false,
  pinned = false,
  dirty = false,
  onSelect,
  onClose,
  style = {},
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: 'var(--tabbar-h)',
        padding: pinned ? '0 8px 0 10px' : '0 8px 0 12px',
        maxWidth: '200px',
        background: active ? 'var(--bg-editor)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--fs-small)',
        cursor: 'pointer',
        borderRight: '1px solid var(--border)',
        boxShadow: active ? 'inset 0 var(--accent-strip-w) 0 0 var(--accent)' : 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        transition: 'background var(--dur-fast) var(--ease-standard)',
        ...style,
      }}
    >
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>

      {/* trailing slot: pin glyph, dirty dot, or hover-close */}
      <span style={{ display: 'inline-flex', alignItems: 'center', width: 14, justifyContent: 'center', flexShrink: 0 }}>
        {pinned ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--text-tertiary)" stroke="none">
            <path d="M12 2 4 10l5 1 1 5 8-8-2-2-2 2-2-6z" />
          </svg>
        ) : hover ? (
          <svg
            onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : dirty ? (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)' }} />
        ) : null}
      </span>
    </div>
  );
}
