import React from 'react';

/**
 * Capisco TreeRow — a single row in the file-explorer tree (or any tree).
 * Handles indentation, an expand chevron for folders, a type icon, the label,
 * and an optional trailing slot (e.g. a <GitMarker/>).
 * Active row: lighter bg + 2px teal strip on the left edge.
 */
export function TreeRow({
  depth = 0,
  expandable = false,
  expanded = false,
  icon,
  label,
  active = false,
  muted = false,
  trailing,
  onClick,
  style = {},
}) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: 'var(--row-h)',
        paddingRight: '8px',
        paddingLeft: `${4 + depth * 14}px`,
        background: active ? 'var(--accent-tint)' : hover ? 'var(--bg-hover)' : 'transparent',
        color: muted ? 'var(--text-tertiary)' : active ? 'var(--text-primary)' : 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--fs-small)',
        cursor: 'pointer',
        userSelect: 'none',
        boxShadow: active ? 'inset var(--accent-strip-w) 0 0 0 var(--accent)' : 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {/* chevron column (always reserved so labels align) */}
      <span style={{ width: 12, flexShrink: 0, display: 'inline-flex', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        {expandable && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform var(--dur-fast) var(--ease-standard)',
            }}
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        )}
      </span>

      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {trailing && <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{trailing}</span>}
    </div>
  );
}
