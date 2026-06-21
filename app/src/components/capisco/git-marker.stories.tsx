import { GitMarker } from "./git-marker";

export const Markers = () => (
  <div className="flex gap-3">
    {(["M", "A", "D", "U"] as const).map((s) => (
      <GitMarker key={s} status={s} />
    ))}
  </div>
);
