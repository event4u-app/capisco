import { Progress } from "./progress";

export const PlanUsage = () => (
  <div className="max-w-xs space-y-3">
    <div>
      <div className="mb-1 flex justify-between text-micro text-muted-foreground">
        <span>Weekly · all models</span>
        <span>93%</span>
      </div>
      <Progress value={93} />
    </div>
    <div>
      <div className="mb-1 flex justify-between text-micro text-muted-foreground">
        <span>Usage credits</span>
        <span>87%</span>
      </div>
      <Progress value={87} />
    </div>
  </div>
);
