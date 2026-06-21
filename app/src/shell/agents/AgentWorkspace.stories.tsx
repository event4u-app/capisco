import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

/**
 * The agent-native core surface (build-spec §4). Sessions / subagents / a
 * centered virtualized transcript / the composer with its control bar. The
 * stories pin the active session so each Ladle frame is deterministic.
 */
function Frame({ activeId }: { activeId: string }) {
  useAgents.setState({ activeId, extra: [], closed: [], settingsOpen: false, runStates: {} });
  return (
    <div className="dark" style={{ height: 720 }}>
      <div className="flex h-full flex-col bg-editor text-foreground">
        <AgentWorkspace />
      </div>
    </div>
  );
}

export const RunningWithBroker = () => <Frame activeId="s1" />;
export const SearchWithCredential = () => <Frame activeId="s3" />;
export const LongTranscript = () => <Frame activeId="s4" />;
