import * as React from "react";
import { useTranslation } from "react-i18next";
import { Code2 } from "lucide-react";

import { mockEditorProvider } from "@/mocks";
import { usePalette } from "@/shell/command-registry";
import { EditorTabStrip } from "./EditorTabStrip";
import { CodeMirrorView } from "./CodeMirrorView";
import { Autocomplete } from "./Autocomplete";
import { InlineBlame, InlayHints, SocialPresenceLane } from "./ProviderOutputs";
import { useEditor } from "./store";

/**
 * Editor workspace (build-spec §7 / roadmap R3). Phase 0: CM6 read-only shell
 * (tab strip + JetBrains-dark code view). Phase 1: provider-output overlays
 * (autocomplete, inlay hints, inline blame, social-presence lane) fed by the
 * MOCK EditorProvider behind src/contracts/editor.ts — never CM6 features.
 */
export function EditorWorkspace() {
  const { t } = useTranslation();
  const activeFile = useEditor((s) => s.activeFile);
  const setActive = useEditor((s) => s.setActive);
  const register = usePalette((s) => s.register);

  // Self-register editor actions in the command palette (escalation ladder).
  React.useEffect(() => {
    const unFocus = register({
      id: "editor:focus",
      group: "view",
      icon: Code2,
      label: t("editor.command.focusEditor"),
      run: () => mockEditorProvider.getDocs()[0] && setActive(mockEditorProvider.getDocs()[0].file),
    });
    return () => unFocus();
  }, [register, t, setActive]);

  const doc = mockEditorProvider.getDoc(activeFile);

  // Provider outputs — all mock data behind the EditorProvider contract.
  const completions = doc ? mockEditorProvider.getCompletions(doc.file, 18) : [];
  const hints = doc ? mockEditorProvider.getInlayHints(doc.file) : [];
  const blame = doc ? mockEditorProvider.getBlame(doc.file) : [];
  const presence = doc ? mockEditorProvider.getPresence(doc.file) : [];
  const activeLine = doc ? mockEditorProvider.getActiveLine(doc.file) : 1;
  const activeBlame = blame.find((b) => b.line === activeLine);

  return (
    <div
      data-testid="editor-workspace"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-editor"
    >
      <EditorTabStrip />
      {doc ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <SocialPresenceLane markers={presence} />
          <div data-testid="code-pane" className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <CodeMirrorView doc={doc} />
            {/* Phase-1 provider-output overlays (mock, not CM6 features). */}
            <InlineBlame blame={activeBlame} />
            <InlayHints hints={hints} />
            <Autocomplete items={completions} />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <span className="font-mono text-code lowercase text-muted-foreground">
            {t("editor.empty")}
          </span>
        </div>
      )}
    </div>
  );
}
