import { Manager } from "@/editor/manager";
import { useEffect, useRef, useState } from "react";
import { TabHeader } from "./components/tab-header";
import { Document } from "@/editor/document";
import { HighTexDB } from "@/editor/storage/hightex-db";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

import { RefreshCw, Monitor, Layout, ZoomIn, Eye } from "lucide-react";
import { uniqId } from "@/utils/uniq-id";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Preview = () => {
  const [loading, setLoading] = useState(true);

  const [autoUpdate, setAutoUpdate] = useState(
    window.config.get()?.previewer.autoUpdate,
  );
  const [layoutIndicator, setLayoutIndicator] = useState(
    window.config.get()?.previewer.layoutIndicator,
  );

  const [scope, setScope] = useState<ConfigShape["previewer"]["scope"]>(
    window.config.get()?.previewer.scope || "current",
  );

  const [zoom, setZoom] = useState<number>(40);
  const [frameKey, setFrameKey] = useState(uniqId());
  const [scrollY, setScrollY] = useState(0);

  const frameRef = useRef<HTMLIFrameElement>(null);

  const reloadFrame = () => {
    if (!frameRef.current) return;
    setFrameKey(uniqId());
    setLoading(true);
  };

  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const doc = win.document;

    if (layoutIndicator) {
      doc.body.classList.add("indicator");
    } else {
      doc.body.classList.remove("indicator");
    }
  }, [layoutIndicator]);

  useEffect(() => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const doc = win.document;

    doc.body.style.zoom = (zoom / 100).toString();
  }, [zoom, loading]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      unsubscribe = window.config.onChange((next) => {
        setAutoUpdate(next.previewer.autoUpdate);
        setLayoutIndicator(next.previewer.layoutIndicator);
        setScope(next.previewer.scope);
      });
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!autoUpdate) return;

    return Manager.app.on("chapter:commit", () => {
      reloadFrame();
    });
  }, [autoUpdate]);

  const updateGlobalConfig = async (
    newScope: typeof scope,
    newAuto: boolean,
    newIndicator: boolean,
  ) => {
    await window.config.set({
      previewer: {
        autoUpdate: newAuto,
        layoutIndicator: newIndicator,
        scope: newScope,
      },
    });
  };

  return (
    <div className="flex flex-col h-full justify-between">
      <TabHeader title="Preview" desc="Paged document rendering preview">
        <div className="flex flex-wrap items-center gap-3 w-full pb-2 border-b border-border/40">
          <div className="flex items-center gap-2 min-w-35">
            <Eye className="w-4 h-4 opacity-60 shrink-0" />
            <Select
              value={scope}
              onValueChange={async (
                value: ConfigShape["previewer"]["scope"],
              ) => {
                setScope(value);
                await updateGlobalConfig(
                  value,
                  !!autoUpdate,
                  !!layoutIndicator,
                );
                reloadFrame();
              }}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="current" className="text-xs">
                    Current Chapter
                  </SelectItem>
                  <SelectItem value="full" className="text-xs">
                    Full Document
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-40 max-w-60 border rounded-lg px-2 py-1 h-8 bg-background">
            <ZoomIn className="w-4 h-4 opacity-60 shrink-0" />
            <span className="text-xs text-muted-foreground select-none w-8 text-right">
              {zoom}%
            </span>
            <Slider
              value={[zoom]}
              min={10}
              max={100}
              step={5}
              onValueChange={(values) => setZoom(values[0])}
              className="flex-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={reloadFrame}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1 h-8 bg-background">
              <Monitor className="w-4 h-4 opacity-60" />
              <span className="text-xs text-muted-foreground select-none">
                Auto
              </span>
              <Switch
                checked={autoUpdate}
                onCheckedChange={async (val) => {
                  setAutoUpdate(val);
                  await updateGlobalConfig(scope, val, !!layoutIndicator);
                }}
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1 h-8 bg-background">
              <Layout className="w-4 h-4 opacity-60" />
              <span className="text-xs text-muted-foreground select-none">
                Layout
              </span>
              <Switch
                checked={layoutIndicator}
                onCheckedChange={async (val) => {
                  setLayoutIndicator(val);
                  await updateGlobalConfig(scope, !!autoUpdate, val);
                }}
              />
            </div>
          </div>
        </div>
      </TabHeader>

      <div className="w-full flex-1 bg-muted/30 flex flex-col relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 p-6 space-y-3 z-10 bg-background/80 backdrop-blur-sm">
            <div className="h-6 w-1/3 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-full bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-5/6 bg-muted animate-pulse rounded-md" />
          </div>
        )}

        <iframe
          className={cn("flex-1 w-full border-0 bg-white")}
          key={frameKey}
          src={
            scope === "current"
              ? `/print/${Document.current!.getId()}`
              : `/document/${Document.instance!.id}/print`
          }
          ref={frameRef}
          onLoad={async () => {
            const win = frameRef.current!.contentWindow!;
            const doc = win.document;

            doc.body.style.zoom = (zoom / 100).toString();

            win.addEventListener("scrollend", () => {
              setScrollY(win.scrollY);
            });
            if (!win.hightex) {
              win.hightex = window.hightex;
            }
            win.inFrame = true;
            win.current = Document.current!;
            win.cites = await HighTexDB.getInstance().cite.toArray();
            doc.body.style.background = "white";
            doc.body.classList.add("preview");
            doc.body.style.transformOrigin = "center";

            if (layoutIndicator) {
              doc.body.classList.add("indicator");
            } else {
              doc.body.classList.remove("indicator");
            }

            doc.addEventListener("page:rendered", () => {
              setLoading(false);
              win.scrollTo(0, scrollY);
            });
          }}
        />
      </div>
    </div>
  );
};
