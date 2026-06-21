import React from 'react';

/**
 * Capisco Button — flat, dense IDE button.
 * variant: 'default' (subtle, bordered) | 'primary' (teal fill) | 'ghost' (no chrome)
 * size: 'sm' (24px) | 'md' (28px)
 */
export function Button({
  variant = 'default',
  size = 'sm',
  disabled = false,
  children,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);

  const base = {
    fontFamily: 'var(--font-sans)',
    fontSize: size === 'md' ? 'var(--fs-base)' : 'var(--fs-small)',
    fontWeight: 'var(--fw-medium)',
    lineHeight: 1,
    height: size === 'md' ? 'var(--control-h-md)' : 'var(--control-h)',
    padding: size === 'md' ? '0 14px' : '0 10px',
    borderRadius: 'var(--radius-1)',
    border: '1px solid transparent',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    cursor: disabled ? 'default' : 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    transition: 'background .12s ease, border-color .12s ease, color .12s ease',
    opacity: disabled ? 0.45 : 1,
    transform: active && !disabled ? 'translateY(0.5px)' : 'none',
  };

  const variants = {
    default: {
      background: hover && !disabled ? 'var(--bg-hover)' : 'transparent',
      borderColor: 'var(--border)',
      color: 'var(--text-primary)',
    },
    primary: {
      background: hover && !disabled ? 'var(--accent-hover)' : 'var(--accent)',
      borderColor: 'transparent',
      color: 'var(--text-on-accent)',
      fontWeight: 'var(--fw-semibold)',
    },
    ghost: {
      background: hover && !disabled ? 'var(--bg-hover)' : 'transparent',
      borderColor: 'transparent',
      color: 'var(--text-secondary)',
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
