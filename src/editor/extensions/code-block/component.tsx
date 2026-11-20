import type { ChapterControlProps } from "@/editor/chapter/content-node-view";
import "highlight.js/styles/github-dark.css";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { common } from "lowlight";

const LANGUAGES = Object.keys(common);

export const CodeBlockComponent: React.FC<ChapterControlProps> = ({
  node,
  updateAttributes,
}) => {
  const language = node.attrs.language || "plaintext";

  return (
    <div
      data-editor-ui
      contentEditable={false}
      style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}
    >
      <Select
        value={language}
        onValueChange={(val) => updateAttributes({ language: val })}
      >
        <SelectTrigger className="h-6 text-xs border-none bg-white/10 text-white w-32 font-sans!">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-2">
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang} value={lang} className="font-sans!">
              {lang == "php" ? "king php" : lang}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
