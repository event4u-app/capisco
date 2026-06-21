/**
 * Capisco BudgetRing — small circular usage ring (data viz, not decoration).
 * From the prototype composer bar (agent.jsx); themed via tokens.
 */
export function BudgetRing({ pct = 87, size = 16 }: { pct?: number; size?: number }) {
  const r = 6;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={`${pct}% used`}>
      <circle cx="8" cy="8" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r={r}
        fill="none"
        stroke="hsl(var(--warning))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
