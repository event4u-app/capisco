import { SignalFlyout } from "./SignalFlyout";

/**
 * Unpinned flyout overlay (R6 §2): a 340px column that floats OVER the center
 * workspace (it does NOT shrink the center grid — that is the pinned-dock
 * behaviour). It sits against the right rail and casts the single system
 * elevation shadow. Clicking anywhere in the workspace closes it (handled by
 * the Shell's workspace click handler); clicking inside the flyout does not.
 */
export function FlyoutOverlay({ channel }: { channel: "alerts" | "inspect" }) {
  return (
    <div
      data-testid={`flyout-overlay-${channel}`}
      // Stop propagation so a click inside the overlay never reaches the
      // workspace close-handler.
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-y-0 right-0 z-20 w-[340px] border-l border-border bg-card shadow-[-8px_0_24px_rgba(0,0,0,0.28)]"
    >
      <SignalFlyout channel={channel} overlay />
    </div>
  );
}
