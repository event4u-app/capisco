import { Button } from "./button";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="default" size="sm">
      Allow once
    </Button>
    <Button variant="outline" size="sm">
      This session
    </Button>
    <Button variant="ghost" size="sm">
      Deny
    </Button>
    <Button variant="destructive" size="sm">
      Discard
    </Button>
  </div>
);
