import { editorGuides } from "./1.2.0/editor";
import { workspaceGuides } from "./1.2.0/workspace";

export default {
  version: "1.2.0",
  guides: [...workspaceGuides, ...editorGuides],
} satisfies GuideRelease;
