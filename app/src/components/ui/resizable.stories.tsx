import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";

export const HorizontalSplit = () => (
  <ResizablePanelGroup
    direction="horizontal"
    className="h-48 max-w-lg rounded-md border border-border"
  >
    <ResizablePanel defaultSize={40}>
      <div className="flex h-full items-center justify-center text-ui text-muted-foreground">
        left panel
      </div>
    </ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel defaultSize={60}>
      <div className="flex h-full items-center justify-center text-ui text-muted-foreground">
        editor
      </div>
    </ResizablePanel>
  </ResizablePanelGroup>
);
