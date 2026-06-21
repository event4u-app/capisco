import React from 'react';

/**
 * Capisco StatusDot — session / process state indicator.
 * status: 'running' (green, softly pulsing) | 'idle' (hollow gray)
 *       | 'waiting' (teal, half-filled — needs approval) | 'error' (red) | 'done' (green)
 */
export function StatusDot({ status = 'idle', size = 8, style = {} }) {
  const map = {
    running: { color: 'var(--success)', fill: true,  pulse: true },
    waiting: { color: 'var(--accent)',  fill: 'half', pulse: false },
    idle:    { color: 'var(--text-tertiary)', fill: false, pulse: false },
    error:   { color: 'var(--error)',   fill: true,  pulse: false },
    done:    { color: 'var(--success)', fill: true,  pulse: false },
  };
  const s = map[status] || map.idle;

  const common = {
    width: size,
    height: size,
    borderRadius: 'var(--radius-pill)',
    flexShrink: 0,
    display: 'inline-block',
    boxSizing: 'border-box',
  };

  let look;
  if (s.fill === 'half') {
    // half-filled: teal ring with a teal left half — reads as "partway / waiting"
    look = {
      border: `1.5px solid ${s.color}`,
      background: `linear-gradient(90deg, ${s.color} 0 50%, transparent 50% 100%)`,
    };
  } else if (s.fill) {
    look = { background: s.color };
  } else {
    look = { border: `1.5px solid ${s.color}`, background: 'transparent' };
  }

  return (
    <span
      title={status}
      style={{
        ...common,
        ...look,
        animation: s.pulse ? 'capisco-pulse 1.6s var(--ease-standard) infinite' : 'none',
        ...style,
      }}
    />
  );
}
