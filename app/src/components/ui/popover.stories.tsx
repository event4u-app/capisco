import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

export const Default = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm">
        Plan usage
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-64">
      <div className="text-ui text-muted-foreground">
        Effort, budget and model popovers (R2) build on this primitive.
      </div>
    </PopoverContent>
  </Popover>
);
