import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import "./styles/fonts";
import "./i18n";
import { ThemeProvider } from "@/lib/theme";
import { connectDevBridge } from "@/lib/dev/connect-dev-bridge";
import App from "./App";

function render(): void {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}

// In dev, try to wire the REAL sidecar over the localhost WS bridge BEFORE the
// app's first getProviders() call (it memoises its selection). Falls back to
// mocks if the bridge is off/unreachable. The production build never connects.
if (import.meta.env.DEV) {
  void connectDevBridge().finally(render);
} else {
  render();
}
