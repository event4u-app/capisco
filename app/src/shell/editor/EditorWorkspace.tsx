import * as React from "react";
import { useTranslation } from "react-i18next";
import { Code2, Save } from "lucide-react";

import { editorSnapshot } from "@/mocks";
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
  const realDocs = useEditor((s) => s.realDocs);
  const tabs = useEditor((s) => s.tabs);
  const setRealDocText = useEditor((s) => s.setRealDocText);
  const saveActive = useEditor((s) => s.saveActive);
  const register = usePalette((s) => s.register);

  // Transient save status surfaced inline (written / gated). Cleared on re-edit.
  const [saveState, setSaveState] = React.useState<null | {
    written: boolean;
    reason?: string;
  }>(null);

  // Self-register editor actions in the command palette (escalation ladder).
  React.useEffect(() => {
    const unFocus = register({
      id: "editor:focus",
      group: "view",
      icon: Code2,
      label: t("editor.command.focusEditor"),
      run: () => editorSnapshot.getDocs()[0] && setActive(editorSnapshot.getDocs()[0].file),
    });
    return () => unFocus();
  }, [register, t, setActive]);

  // Prefer a REAL opened-from-disk doc (P1) over the mock snapshot; the mock
  // path is unchanged when no real doc is present (always so in the visual
  // harness, keeping the goldens byte-identical).
  const realDoc = realDocs[activeFile];
  const doc = realDoc ?? editorSnapshot.getDoc(activeFile);
  // Provider outputs (overlays) are mock-only — a real file has none yet.
  const isReal = !!realDoc;

  // Provider outputs — all mock data behind the EditorProvider contract. A
  // real opened-from-disk doc has no mock overlays (LSP/blame/presence come
  // later); they stay empty so the real view is honest.
  const completions = doc && !isReal ? editorSnapshot.getCompletions(doc.file) : [];
  const hints = doc && !isReal ? editorSnapshot.getInlayHints(doc.file) : [];
  const blame = doc && !isReal ? editorSnapshot.getBlame(doc.file) : [];
  const presence = doc && !isReal ? editorSnapshot.getPresence(doc.file) : [];
  const activeLine = doc && !isReal ? editorSnapshot.getActiveLine(doc.file) : 1;
  const activeBlame = blame.find((b) => b.line === activeLine);

  // Dirty state of the active tab (P2 — drives the Save affordance).
  const activeTab = tabs.find((tt) => tt.file === activeFile);
  const dirty = !!activeTab?.dirty;

  const onSave = React.useCallback(async () => {
    const outcome = await saveActive();
    setSaveState(outcome);
  }, [saveActive]);

  return (
    <div
      data-testid="editor-workspace"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-editor"
    >
      <EditorTabStrip />
      {/* P2 — editable real docs get a Save bar (dirty state + ⌘S broker write).
          The mock snapshot is read-only, so this bar never shows in the visual
          harness and the goldens stay byte-identical. */}
      {doc && isReal && (
        <div
          data-testid="editor-save-bar"
          className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-card px-2 text-micro"
        >
          <button
            type="button"
            data-testid="editor-save"
            disabled={!dirty}
            onClick={() => void onSave()}
            className="flex items-center gap-1 rounded-sm border border-input bg-muted px-2 py-0.5 text-foreground hover:bg-accent disabled:opacity-50"
          >
            <Save className="size-3" aria-hidden />
            {t("editor.save")}
          </button>
          {dirty && (
            <span data-testid="editor-dirty" className="text-muted-foreground">
              {t("editor.unsaved")}
            </span>
          )}
          {saveState && (
            <span
              data-testid={saveState.written ? "editor-saved" : "editor-save-gated"}
              className={
                saveState.written ? "text-muted-foreground" : "text-[hsl(var(--chart-bad))]"
              }
            >
              {saveState.written ? t("editor.saved") : t("editor.saveGated")}
            </span>
          )}
        </div>
      )}
      {doc ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <SocialPresenceLane markers={presence} />
          <div
            data-testid="code-pane"
            className="relative flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <CodeMirrorView
              doc={doc}
              onChange={
                isReal
                  ? (text) => {
                      setRealDocText(doc.file, text);
                      setSaveState(null);
                    }
                  : undefined
              }
              onSave={isReal ? () => void onSave() : undefined}
            />
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
