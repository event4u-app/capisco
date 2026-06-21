import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

export const ScrollableList = () => (
  <ScrollArea className="h-40 w-56 rounded-md border border-border p-2">
    <div className="text-ui">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i}>
          <div className="py-1 font-mono text-code text-muted-foreground">session_{i + 1}</div>
          {i < 19 && <Separator />}
        </div>
      ))}
    </div>
  </ScrollArea>
);
