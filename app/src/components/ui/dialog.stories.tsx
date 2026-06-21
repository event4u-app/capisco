import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Button } from "./button";

export const Default = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm">
        Open dialog
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Agent backend</DialogTitle>
        <DialogDescription>API client or installed CLI.</DialogDescription>
      </DialogHeader>
    </DialogContent>
  </Dialog>
);
