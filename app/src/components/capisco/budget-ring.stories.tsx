import { BudgetRing } from "./budget-ring";

export const Levels = () => (
  <div className="flex items-center gap-3">
    {[12, 50, 87, 100].map((p) => (
      <BudgetRing key={p} pct={p} size={20} />
    ))}
  </div>
);
