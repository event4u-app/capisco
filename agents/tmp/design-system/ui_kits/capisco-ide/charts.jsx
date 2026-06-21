/* Capisco IDE kit — lightweight SVG charts for the Git dashboard. */

/* Smooth-ish line chart over weekly data, with x-axis labels. */
function LineChart({ data, labels, color = 'var(--accent)', height = 150, fmt = (v) => v }) {
  const W = 640, H = height, pad = { l: 38, r: 10, t: 12, b: 22 };
  const max = Math.max(...data), min = Math.min(0, ...data);
  const span = max - min || 1;
  const x = (i) => pad.l + i * (W - pad.l - pad.r) / (data.length - 1);
  const y = (v) => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [max, min + span * 0.5, min];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {ticks.map((t, i) => {
        const yy = pad.t + (1 - (t - min) / span) * (H - pad.t - pad.b);
        return <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={pad.l - 6} y={yy + 3} className="chart-axis" textAnchor="end">{fmt(Math.round(t))}</text>
        </g>;
      })}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill="var(--surface-editor)" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      {labels.map((l, i) => (i % 2 === 0) && <text key={i} x={x(i)} y={H - 6} className="chart-axis" textAnchor="middle">{l}</text>)}
    </svg>
  );
}

/* Donut chart for category split. */
function Donut({ segments, size = 150 }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 54, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" width={size} height={size}>
        <g transform="rotate(-90 80 80)">
          {segments.map((s, i) => {
            const len = c * s.value / total;
            const el = <circle key={i} cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="22" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <div className="donut-legend">
        {segments.map((s) => (
          <span key={s.label} className="dl-item"><span className="dl-dot" style={{ background: s.color }} />{s.label} <b>{Math.round(s.value / total * 100)}%</b></span>
        ))}
      </div>
    </div>
  );
}

/* DORA-style metric card. */
function MetricCard({ m }) {
  return (
    <div className="mc">
      <div className="mc-top">
        <span className="mc-label">{m.label}</span>
        {m.tier && <span className={'mc-tier tier-' + m.tier.toLowerCase()}>{m.tier}</span>}
      </div>
      <div className="mc-val">{m.value}{m.delta && <span className={'mc-delta ' + (m.good ? 'good' : 'bad')}>{m.delta}</span>}</div>
      <div className="mc-sub">{m.sub}</div>
    </div>
  );
}

/* Card shell with the reference toolbar (image / download / expand / bookmark). */
function ChartCard({ title, children }) {
  return (
    <div className="cc">
      <div className="cc-head">
        <span className="cc-title">{title}</span>
        <div className="cc-tools">
          <Icon name="image" size={14} color="var(--text-tertiary)" />
          <Icon name="download" size={14} color="var(--text-tertiary)" />
          <Icon name="maximize-2" size={14} color="var(--text-tertiary)" />
          <Icon name="bookmark" size={14} color="var(--text-tertiary)" />
        </div>
      </div>
      <div className="cc-body">{children}</div>
    </div>
  );
}

/* Working-times heatmap: 7 days × 24h. Green = core hours, red = off-hours/weekend. */
function Heatmap({ grid, coreStart, coreEnd }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="hm">
      <div className="hm-row hm-hours">
        <span className="hm-day" />
        {Array.from({ length: 24 }, (_, h) => {
          const off = h < coreStart || h >= coreEnd;
          return <span key={h} className={'hm-h' + (off ? ' off' : '')}>{h}h</span>;
        })}
      </div>
      {grid.map((row, d) => {
        const weekend = d >= 5;
        return (
          <div className="hm-row" key={d}>
            <span className={'hm-day' + (weekend ? ' off' : '')}>{days[d]}</span>
            {row.map((v, h) => {
              const off = weekend || h < coreStart || h >= coreEnd;
              const base = off ? '231,76,60' : '46,168,90';
              const op = 0.16 + v * 0.84;
              return <span key={h} className="hm-cell" title={`${days[d]} ${h}:00 · ${Math.round(v * 100)}%`} style={{ background: `rgba(${base},${off ? Math.max(0.16, v) : op})` }} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

/* Burndown: ideal (dashed) vs actual (solid, stops at today). */
function BurndownChart({ ideal, actual, height = 200, accent = "var(--accent)" }) {
  const W = 640, H = height, pad = { l: 34, r: 12, t: 12, b: 24 };
  const n = ideal.length;
  const max = Math.max(...ideal, ...actual.filter((v) => v != null));
  const x = (i) => pad.l + i * (W - pad.l - pad.r) / (n - 1);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const idealPts = ideal.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const actualPts = actual.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(" ");
  const lastIdx = actual.reduce((a, v, i) => (v != null ? i : a), 0);
  const ticks = [max, max / 2, 0];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {ticks.map((t, i) => {
        const yy = pad.t + (1 - t / max) * (H - pad.t - pad.b);
        return <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <text x={pad.l - 6} y={yy + 3} className="chart-axis" textAnchor="end">{Math.round(t)}</text>
        </g>;
      })}
      <polyline points={idealPts} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={actualPts} fill="none" stroke={accent} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lastIdx)} cy={y(actual[lastIdx])} r="3" fill={accent} />
      {ideal.map((_, i) => (i % 2 === 0) && <text key={i} x={x(i)} y={H - 7} className="chart-axis" textAnchor="middle">d{i}</text>)}
    </svg>
  );
}

Object.assign(window, { LineChart, BurndownChart, Donut, MetricCard, ChartCard, Heatmap });
