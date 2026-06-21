import * as React from "react";
import { ServicesPanel } from "./ServicesPanel";
import { DataPanel } from "./DataPanel";
import { SignalFlyout } from "../signals/SignalFlyout";

/** R6 Tooling-Breadth provider views, each in a panel-sized frame. */
function PanelFrame({ children, width = 300, height = 560 }: { children: React.ReactNode; width?: number; height?: number }) {
  return (
    <div
      style={{ width, height }}
      className="overflow-hidden rounded border border-border bg-card text-foreground"
    >
      {children}
    </div>
  );
}

export const Services = () => (
  <PanelFrame>
    <ServicesPanel />
  </PanelFrame>
);

export const Data = () => (
  <PanelFrame>
    <DataPanel />
  </PanelFrame>
);

export const AlertsFlyout = () => (
  <PanelFrame width={340}>
    <SignalFlyout channel="alerts" />
  </PanelFrame>
);

export const InspectFlyout = () => (
  <PanelFrame width={340}>
    <SignalFlyout channel="inspect" />
  </PanelFrame>
);
