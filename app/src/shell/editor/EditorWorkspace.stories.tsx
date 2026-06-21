import { EditorWorkspace } from "./EditorWorkspace";

/**
 * Editor workspace story (Overview §4(b) component stories). CM6 read-only
 * shell + Phase-1 provider-output overlays. Rendered in a sized dark frame.
 */
export const Editor = () => (
  <div className="dark h-[560px] w-full bg-editor text-foreground">
    <EditorWorkspace />
  </div>
);

Editor.storyName = "Editor workspace";
