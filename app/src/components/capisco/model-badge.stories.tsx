import { ModelBadge } from "./model-badge";

export const Tones = () => (
  <div className="flex gap-2">
    <ModelBadge>Claude</ModelBadge>
    <ModelBadge spotlight>GPT-5</ModelBadge>
    <ModelBadge>Local</ModelBadge>
  </div>
);
