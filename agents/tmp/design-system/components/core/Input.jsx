import React from 'react';

/**
 * Capisco Input — sunken field used in search, terminal command line,
 * the agent message composer, and settings.
 * Optional `leading` / `trailing` slots for icons or a send button.
 */
export function Input({
  value,
  defaultValue,
  placeholder,
  leading,
  trailing,
  mono = false,
  disabled = false,
  onChange,
  style = {},
  inputStyle = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: 'var(--control-h-md)',
        padding: '0 8px',
        background: 'var(--surface-input)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-1)',
        transition: 'border-color .12s ease',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {leading && (
        <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {leading}
        </span>
      )}
      <input
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: mono ? 'var(--fs-code)' : 'var(--fs-small)',
          ...inputStyle,
        }}
        {...rest}
      />
      {trailing && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {trailing}
        </span>
      )}
    </div>
  );
}
