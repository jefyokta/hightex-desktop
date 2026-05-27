import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageIsInFigure } from "@/exception/image-is-in-figure";
import { base64ToPngBlob } from "@/utils/is-base-64";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { GalleryThumbnails, Images, Trash, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const ImageComponent: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  getPos,
  editor,
}) => {
  const [src, setSrc] = useState<string | null>(node.attrs.src || null);
  const [width, setWidth] = useState<number>(
    parseInt(node.attrs.width || "200"),
  );
  const imgRef = useRef<HTMLImageElement>(null);
  const resizing = useRef(false);
  const isBase64 = (src: string) =>
    /^data:image\/(png|jpg|jpeg);base64,/.test(src);

  useEffect(() => {
    if (src) {
      queueMicrotask(() => {
        if (isBase64(src)) {
          updateAttributes({ src });
        } else {
          updateAttributes({ src: null });
        }
      });
    }
  }, [src]);

  useEffect(() => {
    requestAnimationFrame(() => {
      updateAttributes({ width: width.toString() });
    });
  }, [width]);

  const deleteImage = () => {
    setSrc(null);
  };

  const copy = async (base64: string) => {
    const blob = base64ToPngBlob(base64);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.log(err);
    }
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = imgRef.current?.offsetWidth || width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizing.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      resizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const toFigure = () => {
    if (node.type.name !== "image") {
      return;
    }
    const pos = getPos();
    if (!pos) {
      return;
    }
    const resolved = editor.state.doc.resolve(pos);
    const parent = resolved.node(resolved.depth);
    if (parent.type.name == "imageFigure") {
      throw new ImageIsInFigure();
    }

    const image = node.copy();
    const caption = editor.schema.nodes.figcaption.create(null, []);
    const figure = editor.schema.nodes.imageFigure.create(null, [
      image,
      caption,
    ]);
    const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, figure);
    editor.view.dispatch(tr);
  };

  return (
    <NodeViewWrapper className="relative group flex justify-center">
      {src ? (
        <>
          <img
            ref={imgRef}
            src={src}
            alt=""
            style={{ width: width }}
            className="h-auto"
            onError={() => {
              setSrc(null);
            }}
            onLoad={() => {}}
          />
          <span
            className="absolute top-1/2 right-0 cursor-ew-resize bg-blue-100 dark:bg-blue-900/50 w-1.5 h-6 rounded-sm hidden group-hover:block"
            onMouseDown={startResize}
          />
          <div className="absolute top-2 left-2 z-50 hidden group-hover:flex space-x-2">
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-sm rounded py-1 px-1"
                  onClick={async () => {
                    await copy(src);
                  }}
                >
                  <Images className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>copy</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-sm rounded py-1 px-1"
                  onClick={() => toFigure()}
                >
                  <GalleryThumbnails className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>to Figure</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 shadow-sm rounded py-1 px-1"
                  onClick={deleteImage}
                >
                  <Trash className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>delete image</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white border border-red-700 dark:border-red-800 shadow-sm rounded py-1 px-1"
                  onClick={() => deleteNode()}
                >
                  <X className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>delete node</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : (
        <div className="relative">
          <div className="absolute top-2 right-2 z-50">
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 shadow-sm rounded py-1 px-1"
                  onClick={() => deleteNode()}
                >
                  <X className="w-4 h-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>delete node</TooltipContent>
            </Tooltip>
          </div>

          <ImageInput onSelect={setSrc} />
        </div>
      )}
    </NodeViewWrapper>
  );
};

const ImageInput: React.FC<{ onSelect: (src: string) => void }> = ({
  onSelect,
}) => {
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const file = await resizeImage(f);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onSelect(base64);
    };
    reader.readAsDataURL(file);
  };

  const resizeImage = async (file: File): Promise<File> => {
    const maxSize = 2 * 1000 * 1000;
    if (file.size <= maxSize) return file;

    const ratio = Math.sqrt(maxSize / file.size);

    const img = await createImageBitmap(file);
    const canvas = document.createElement("canvas");

    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;

    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85),
    );

    return new File([blob], file.name, { type: "image/jpeg" });
  };

  return (
    <div className="border border-dashed border-neutral-300 dark:border-neutral-700 flex justify-center flex-col items-center rounded text-sm text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 w-72 h-40 p-4 relative">
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
      />
      <p className="pointer-events-none">Upload image</p>
    </div>
  );
};
