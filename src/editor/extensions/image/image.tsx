import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { convertImage } from "@/utils/images-to-webp";
import { ImageIsInFigure } from "@/exception/image-is-in-figure";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { GalleryThumbnails, Images, Loader2, Trash, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type ChangeEvent,
} from "react";
import { Document } from "@/editor/document";
import { ImageConvertError } from "@/exception/image-convert";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; blobUrl: string }
  | { status: "error"; message: string };

export const ImageComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  getPos,
  editor,
}) => {
  const dbId = node.attrs["src"] as string | null;
  const initWidth = (node.attrs["width"] as number) ?? 400;

  const [load, setLoad] = useState<LoadState>({ status: "idle" });
  const [width, setWidth] = useState<number>(initWidth);

  const imgRef = useRef<HTMLImageElement>(null);
  const resizing = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (dbId === null) {
      setLoad({ status: "idle" });
      return;
    }

    let cancelled = false;
    setLoad({ status: "loading" });

    const db = HighTexDB.getInstance();
    const documentId = Document.instance!.id;
    const resolve = async () => {
      if (dbId.startsWith("data:")) {
        const newId = await convertImage(dbId, documentId);
        if (cancelled) return;

        updateAttributes({ src: newId });
        return;
      }

      const url = await db.getBlobUrl(dbId);
      if (cancelled) return;
      if (url === null) {
        setLoad({ status: "error", message: `Image not found (id: ${dbId})` });
        return;
      }
      if (blobUrlRef.current !== null) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      setLoad({ status: "ready", blobUrl: url });
    };

    resolve().catch((err: unknown) => {
      if (!cancelled) setLoad({ status: "error", message: String(err) });
    });

    return () => {
      cancelled = true;
      if (blobUrlRef.current !== null) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [dbId, editor, updateAttributes]);

  useEffect(() => {
    const id = requestAnimationFrame(() => updateAttributes({ width }));
    return () => cancelAnimationFrame(id);
  }, [width, updateAttributes]);

  const handleDelete = useCallback(async () => {
    if (dbId !== null) await HighTexDB.getInstance().deleteImageById(dbId);
    deleteNode();
  }, [dbId, deleteNode]);

  const handleCopy = useCallback(async () => {
    if (load.status !== "ready") return;
    try {
      const res = await fetch(load.blobUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch (err) {
      console.error("[ImageComponent] copy failed", err);
    }
  }, [load]);

  const startResize = useCallback(
    (e: RMouseEvent) => {
      e.preventDefault();
      resizing.current = true;
      const startX = e.clientX;
      const startWidth = imgRef.current?.offsetWidth ?? width;

      const onMove = (mv: MouseEvent) => {
        if (!resizing.current) return;
        setWidth(Math.max(50, startWidth + mv.clientX - startX));
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width],
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
      editor.state.tr.replaceWith(pos, pos + node.nodeSize, figure),
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
        }
      }
    },
    [editor, updateAttributes],
  );

  return (
    <NodeViewWrapper className="relative group flex justify-center">
      {load.status === "ready" ? (
        <ReadyView
          blobUrl={load.blobUrl}
          width={width}
          imgRef={imgRef}
          onStartResize={startResize}
          onCopy={handleCopy}
          onToFigure={toFigure}
          onDeleteImage={handleDelete}
          onDeleteNode={deleteNode}
        />
      ) : load.status === "loading" ? (
        <LoadingView width={width} />
      ) : load.status === "error" ? (
        <UploadView onSelect={handleUpload} onDeleteNode={deleteNode} />
      ) : (
        <UploadView onSelect={handleUpload} onDeleteNode={deleteNode} />
      )}
    </NodeViewWrapper>
  );
};

interface ReadyViewProps {
  blobUrl: string;
  width: number;
  imgRef: React.RefObject<HTMLImageElement>;
  onStartResize: (e: RMouseEvent) => void;
  onCopy: () => void;
  onToFigure: () => void;
  onDeleteImage: () => void;
  onDeleteNode: () => void;
}

const ReadyView: React.FC<ReadyViewProps> = ({
  blobUrl,
  width,
  imgRef,
  onStartResize,
  onCopy,
  onToFigure,
  onDeleteImage,
  onDeleteNode,
}) => (
  <>
    <img
      ref={imgRef}
      src={blobUrl}
      alt=""
      style={{ width }}
      className="h-auto"
    />
    <span
      className="absolute top-1/2 right-0 cursor-ew-resize bg-blue-100 dark:bg-blue-900/50 w-1.5 h-6 rounded-sm hidden group-hover:block"
      onMouseDown={onStartResize}
    />
    <div className="absolute top-2 left-2 z-50 hidden group-hover:flex space-x-2">
      <IconBtn tooltip="Copy image" onClick={onCopy}>
        <Images className="w-4 h-4" />
      </IconBtn>
      <IconBtn tooltip="Wrap in figure" onClick={onToFigure}>
        <GalleryThumbnails className="w-4 h-4" />
      </IconBtn>
      <IconBtn
        tooltip="Delete image"
        variant="danger-soft"
        onClick={onDeleteImage}
      >
        <Trash className="w-4 h-4" />
      </IconBtn>
      <IconBtn tooltip="Remove node" variant="danger" onClick={onDeleteNode}>
        <X className="w-4 h-4" />
      </IconBtn>
    </div>
  </>
);

const LoadingView: React.FC<{ width: number }> = ({ width }) => (
  <div
    className="flex items-center justify-center w-full bg-neutral-100 dark:bg-neutral-800 rounded"
    style={{ height: Math.round(width * 0.6) }}
  >
    <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
  </div>
);

interface UploadViewProps {
  onSelect: (file: File) => void;
  onDeleteNode: () => void;
}

const UploadView: React.FC<UploadViewProps> = ({ onSelect, onDeleteNode }) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file !== undefined) onSelect(file);
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-50">
        <IconBtn tooltip="Remove node" variant="danger" onClick={onDeleteNode}>
          <X className="w-4 h-4" />
        </IconBtn>
      </div>
      <label className="border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col justify-center items-center rounded text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 w-72 h-40 p-4 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors">
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleChange}
        />
        <span>Click or drop image</span>
      </label>
    </div>
  );
};

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
