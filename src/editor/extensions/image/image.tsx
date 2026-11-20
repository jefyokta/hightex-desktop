import { useAppLanguage } from "@/hooks/use-app-language";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { convertImage, convertToPng } from "@/utils/images-to-webp";
import { ImageIsInFigure } from "@/exception/image-is-in-figure";
import type { ChapterControlProps } from "@/editor/chapter/content-node-view";
import {
  GalleryThumbnails,
  Images,
  Loader2,
  Upload,
  Trash,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type ChangeEvent,
} from "react";
import { Document } from "@/editor/document";
import { ImageConvertError } from "@/exception/image-convert";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { toast } from "sonner";
import { t } from "@/utils/lang";
import { MISSING_IMAGE_SOURCE } from "./fallback";
import { imageWidth } from "./size";
import { paginationReport } from "@/editor/pagination/report-error";
import { liveQuery } from "dexie";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

export const ImageComponent: React.FC<ChapterControlProps> = ({
  node,
  updateAttributes,
  deleteNode,
  getPos,
  editor,
  content,
}) => {
  useAppLanguage();
  const dbId = node.attrs["src"] as string | null;
  const width = imageWidth(node.attrs["width"]);

  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  const image = content.querySelector("img")!;
  const resizing = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    let active = true;
    content.dataset.imageStatus = "loading";
    image.src = load.status === "ready" ? load.blobUrl : MISSING_IMAGE_SOURCE;
    image.alt = load.status === "ready" ? "" : "Gambar tidak tersedia";
    const unavailable = () =>
      setLoad({ status: "error", message: "Gambar tidak tersedia" });
    image.addEventListener("error", unavailable);
    if (load.status !== "loading")
      void image.decode().then(
        () => {
          if (active)
            content.dataset.imageStatus =
              load.status === "ready" ? "ready" : "missing";
        },
        () => {
          if (active) unavailable();
        },
      );
    return () => {
      active = false;
      image.removeEventListener("error", unavailable);
    };
  }, [content, image, load]);

  useEffect(() => {
    if (!dbId) {
      setLoad({ status: "idle" });
      return;
    }

    let cancelled = false;
    setLoad({ status: "loading" });

    const db = HighTexDB.getInstance();
    const documentId = Document.instance!.id;
    const failed = (err: unknown) => {
      if (!cancelled) {
        setLoad({ status: "error", message: String(err) });
        const report = paginationReport(err, "Memuat gambar editor");
        if (report) throw report;
      }
    };
    // Only this record is observed. Allocate URLs on delivery, so an async read
    // finishing after unsubscribe cannot allocate an unowned URL.
    const subscription = dbId.startsWith("data:")
      ? undefined
      : liveQuery(() => db.images.get(dbId)).subscribe({
          next: (record) => {
            if (cancelled) return;
            try {
              const previous = blobUrlRef.current;
              const url = record ? URL.createObjectURL(record.blob) : null;
              blobUrlRef.current = url;
              if (url) setLoad({ status: "ready", blobUrl: url });
              else
                setLoad({
                  status: "error",
                  message: `Image not found (id: ${dbId})`,
                });
              if (previous) URL.revokeObjectURL(previous);
            } catch (error) {
              failed(error);
            }
          },
          error: failed,
        });
    if (dbId.startsWith("data:"))
      void convertImage(dbId, documentId)
        .then((newId) => {
          if (!cancelled) updateAttributes({ src: newId });
        })
        .catch(failed);

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [dbId, editor, updateAttributes]);

  const handleDelete = useCallback(async () => {
    if (dbId !== null) await HighTexDB.getInstance().deleteImageById(dbId);
    deleteNode();
  }, [dbId, deleteNode]);

  const handleCopy = useCallback(async () => {
    if (load.status !== "ready") return;
    try {
      const res = await fetch(load.blobUrl);
      const rawBlob = await res.blob();
      const blob = await convertToPng(rawBlob);

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success(t("editor.expandable.citation.copied"));
    } catch (err) {
      console.error("[ImageComponent] copy failed", err);
      throw new ShouldNotified(ApplicationError.normilize(err));
    }
  }, [load]);

  const startResize = useCallback(
    (e: RMouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startWidth = image.offsetWidth || width;

      const onMove = (mv: MouseEvent) => {
        if (!resizing.current) return;
        updateAttributes({
          width: Math.max(50, startWidth + mv.clientX - startX),
        });
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, image, updateAttributes],
  );

  const toFigure = useCallback(() => {
    if (node.type.name !== "image") return;
    const pos = getPos();
    if (pos === undefined) return;
    const resolved = editor.state.doc.resolve(pos);
    const parent = resolved.node(resolved.depth);
    if (parent.type.name === "imageFigure") throw new ImageIsInFigure();
    const caption = editor.schema.nodes["figcaption"]?.create(null, []);
    const figure = editor.schema.nodes["imageFigure"]?.create(
      null,
      caption ? [node.copy(node.content), caption] : [node.copy(node.content)],
    );
    if (figure === undefined) return;
    editor.view.dispatch(
      editor.state.tr.replaceWith(pos, pos + node.nodeSize, figure as any),
    );
  }, [node, getPos, editor]);

  const handleUpload = useCallback(
    async (file: File) => {
      const documentId: string = Document.instance!.id;
      try {
        const id = await convertImage(file, documentId);
        updateAttributes({ src: id });
      } catch (err) {
        if (err instanceof ImageConvertError) {
          setLoad({ status: "error", message: err.message });
        } else throw err;
      }
    },
    [editor, updateAttributes],
  );

  return (
    <>
      {load.status === "ready" ? (
        <ReadyView
          onStartResize={startResize}
          onCopy={handleCopy}
          onToFigure={toFigure}
          onDeleteImage={handleDelete}
          onDeleteNode={deleteNode}
        />
      ) : (
        <>
          <div
            data-editor-ui
            contentEditable={false}
            className="absolute top-2 left-2 flex items-center gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto"
          >
            {load.status === "loading" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            <label className="cursor-pointer rounded border bg-white px-2 py-1 text-sm text-neutral-900 focus-within:ring-2">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                  event.target.value = "";
                }}
              />
              <span className="flex items-center gap-1">
                <Upload className="size-4" />
                {t("editor.inline.image_drop")}
              </span>
            </label>
            <IconBtn
              tooltip={t("editor.inline.delete")}
              variant="danger"
              onClick={deleteNode}
            >
              <X className="size-4" />
            </IconBtn>
          </div>
        </>
      )}
    </>
  );
};

interface ReadyViewProps {
  onStartResize: (e: RMouseEvent) => void;
  onCopy: () => void;
  onToFigure: () => void;
  onDeleteImage: () => void;
  onDeleteNode: () => void;
}

const ReadyView: React.FC<ReadyViewProps> = ({
  onStartResize,
  onCopy,
  onToFigure,
  onDeleteImage,
  onDeleteNode,
}) => (
  <>
    <span
      data-editor-ui
      contentEditable={false}
      className="absolute top-1/2 right-0 cursor-ew-resize bg-blue-100 dark:bg-blue-900/50 w-1.5 h-6 rounded-sm hidden group-hover:block"
      onMouseDown={onStartResize}
    />
    <div
      data-editor-ui
      contentEditable={false}
      className="absolute top-2 left-2 z-50 hidden group-hover:flex space-x-2"
    >
      <IconBtn tooltip={t("editor.inline.image_copy")} onClick={onCopy}>
        <Images className="w-4 h-4" />
      </IconBtn>
      <IconBtn tooltip={t("editor.inline.wrap_figure")} onClick={onToFigure}>
        <GalleryThumbnails className="w-4 h-4" />
      </IconBtn>
      <IconBtn
        tooltip={t("editor.context_menu.delete_image")}
        variant="danger-soft"
        onClick={onDeleteImage}
      >
        <Trash className="w-4 h-4" />
      </IconBtn>
      <IconBtn
        tooltip={t("editor.inline.delete")}
        variant="danger"
        onClick={onDeleteNode}
      >
        <X className="w-4 h-4" />
      </IconBtn>
    </div>
  </>
);

type BtnVariant = "default" | "danger-soft" | "danger";

const VARIANT_CLS: Record<BtnVariant, string> = {
  default:
    "bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700",
  "danger-soft":
    "bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-950/80 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50",
  danger:
    "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white border-red-700 dark:border-red-800",
};

interface IconBtnProps {
  tooltip: string;
  onClick: () => void;
  variant?: BtnVariant;
  children: React.ReactNode;
}

const IconBtn: React.FC<IconBtnProps> = ({
  tooltip,
  onClick,
  variant = "default",
  children,
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        className={`cursor-pointer border shadow-sm rounded py-1 px-1 ${VARIANT_CLS[variant]}`}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);
