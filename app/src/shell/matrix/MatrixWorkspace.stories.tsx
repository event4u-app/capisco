import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { MatrixWorkspace } from "./MatrixWorkspace";

/** Agent-Matrix v1 (P0) — read-only session/subagent graph over the mock stream. */
export default { title: "Shell / Matrix" };

export const Default = () => (
  <ThemeProvider>
    <div style={{ height: 720 }}>
      <MatrixWorkspace />
    </div>
  </ThemeProvider>
);

/** Degradation view: forcing the node budget low switches to the tree. */
export const TreeFallback = () => (
  <ThemeProvider>
    <div style={{ height: 720 }}>
      <MatrixWorkspace nodeLimit={1} />
    </div>
  </ThemeProvider>
);
