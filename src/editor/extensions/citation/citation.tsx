import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { formatManual } from "@/utils/citation";
//@ts-ignore
import Cite from "citation-js";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { CiteUtils } from "bibtex.js";
export const Citation: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
}) => {
  const [fetchedCite, setFetchedCite] = useState("(Loading)");
  const [valid, setValid] = useState(false);

  const [open, setOpen] = useState(false);
  const [manualInput, setManualInput] = useState({
    text: node.attrs.text || "",
    year: node.attrs.year || "",
  });
  const [bibliography, setBiblography] = useState("");

  useEffect(() => {
    if (!node.attrs.cite) {
      setFetchedCite("(unknown citation)");
      setValid(false);
      return;
    }

    let mounted = true;
    const fetchCite = async () => {
      const cite = await HighTexDB.getInstance().cite.get(node.attrs.cite);
      if (!mounted) return;

      if (!cite) {
        setFetchedCite("(unknown citation)");
        setValid(false);
        return;
      }

      const cu = new CiteUtils(cite.bib).setId(cite.key);

      const dp = new Cite(cu.getCite());
      const biblio = dp.format("bibliography", {
        format: "text",
        template: "apa",
      });
      setFetchedCite(node.attrs.citeA ? cu.toCiteA() : cu.toCite());

      setBiblography(biblio);
      setValid(true);
    };

    fetchCite();
    return () => {
      mounted = false;
    };
  }, [node.attrs.cite, node.attrs.citeA]);

  const display =
    node.attrs.manual && valid
      ? formatManual(manualInput.text, manualInput.year, node.attrs.citeA)
      : fetchedCite;

  return (
    <NodeViewWrapper as="span">
      <Popover modal open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <cite className="cursor-pointer rounded  hover:bg-yellow-200">
            {display}
          </cite>
        </PopoverTrigger>

        <PopoverContent className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-md">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Citation
          </h2>

          <div className="mb-4 rounded-md bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
            {bibliography || "No metadata available"}
          </div>

          <Tabs defaultValue="format">
            <TabsList className="grid grid-cols-2 mb-3">
              <TabsTrigger value="format">Format</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="format" className="space-y-2">
              <button
                className={`w-full rounded px-3 py-2 text-left text-sm transition ${!node.attrs.citeA ? "bg-slate-100 text-slate-900 font-medium" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => updateAttributes({ citeA: false })}
              >
                Standard cite
              </button>
              <button
                className={`w-full rounded px-3 py-2 text-left text-sm transition ${node.attrs.citeA ? "bg-slate-100 text-slate-900 font-medium" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                onClick={() => updateAttributes({ citeA: true })}
              >
                Cite author
              </button>
            </TabsContent>

            <TabsContent value="edit" className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={node.attrs?.manual}
                  onCheckedChange={(e) => {
                    updateAttributes({ manual: e });
                  }}
                />
                <p className="text-sm text-slate-700">Manual override</p>
              </div>

              {node.attrs.manual && (
                <div className="space-y-2">
                  <Input
                    placeholder="Override teks (opsional)"
                    value={manualInput.text}
                    onChange={(e) =>
                      setManualInput((p) => ({ ...p, text: e.target.value }))
                    }
                    onKeyUp={() => updateAttributes({ text: manualInput.text })}
                  />
                  <Input
                    placeholder="Override tahun (opsional)"
                    value={manualInput.year}
                    onChange={(e) =>
                      setManualInput((p) => ({ ...p, year: e.target.value }))
                    }
                    onKeyUp={() => updateAttributes({ year: manualInput.year })}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>
    </NodeViewWrapper>
  );
};
