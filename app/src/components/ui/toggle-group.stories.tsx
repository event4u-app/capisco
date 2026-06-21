import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export const DiffMode = () => (
  <ToggleGroup type="single" defaultValue="split" size="sm">
    <ToggleGroupItem value="split">Split</ToggleGroupItem>
    <ToggleGroupItem value="unified">Unified</ToggleGroupItem>
  </ToggleGroup>
);
