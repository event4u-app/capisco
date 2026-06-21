import React from 'react';

/**
 * Capisco IconButton — square, monochrome icon control.
 * Used in toolbars, activity bars, panel headers, hover-row actions.
 * Pass any element as `icon` (an <i data-lucide> node, an <svg>, or a glyph).
 * `active` gives the JetBrains selected look (lighter bg + teal edge strip).
 */
export function IconButton({
  icon,
  active = false,
  edge = 'left',          // which side the active accent strip sits on
  size = 28,
  title,
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);

  const strip = active
    ? { boxShadow: `inset ${edge === 'right' ? '-' : ''}var(--accent-strip-w) 0 0 0 var(--accent)` }
    : {};

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 'var(--radius-1)',
        background: active
          ? 'var(--accent-tint)'
          : hover && !disabled
          ? 'var(--bg-hover)'
          : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background .12s ease, color .12s ease',
        ...strip,
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
