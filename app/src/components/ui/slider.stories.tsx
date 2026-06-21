import { Slider } from "./slider";

export const Effort = () => (
  <div className="max-w-xs">
    <div className="mb-2 flex justify-between text-micro text-muted-foreground">
      <span>Faster</span>
      <span>Smarter</span>
    </div>
    <Slider defaultValue={[3]} min={0} max={5} step={1} />
  </div>
);
