import { StatusDot } from "./status-dot";

const STATUSES = ["running", "idle", "waiting", "error", "done"] as const;

export const AllStatuses = () => (
  <div className="flex items-center gap-4 font-mono text-code">
    {STATUSES.map((s) => (
      <span key={s} className="flex items-center gap-1.5">
        <StatusDot status={s} />
        {s}
      </span>
    ))}
  </div>
);
