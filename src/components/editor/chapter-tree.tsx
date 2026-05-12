import { useGraph } from "../../hooks/use-graph";
import { TextRenderer } from "./text-renderer";

export const ChapteTree = () => {
  const { headings } = useGraph();
  return (
    <div className="w-24 md:w-48 bg-white/70  p-4">
      {headings.map((h) => (
        <div key={h.id}>
          <TextRenderer texts={h.text} />
        </div>
      ))}
    </div>
  );
};
