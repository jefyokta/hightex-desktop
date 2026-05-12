import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      // toast.success("Copied", {
      //     position: "bottom-right"
      // })
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

  // const { addWarning } = useWarning()

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
      // addWarning({ message: "Image already inside the figure!", elementId: uniqId() })
      return;
    }

    //if node.parent.type.name == 'imageFigure' returj
    const image = node.copy();
    // node.replace(getPos,)

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
            className={`h-auto  `}
            onError={(e) => {
              // e.currentTarget.onerror = null;
              setSrc(null);
              // e.currentTarget.src = "/images/placeholder.png";
            }}
            onLoad={() => {}}
          />
          <span
            className="absolute  top-1/2 right-0  cursor-ew-resize bg-blue-100 w-1.5 h-6 rounded-sm hidden group-hover:block"
            onMouseDown={startResize}
          />
          <div className="absolute top-2 left-2 z-50 hidden group-hover:flex space-x-2">
            <Tooltip>
              <TooltipTrigger>
                <div
                  className="cursor-pointer bg-slate-200 hover:bg-slate-400 rounded py-1 px-1"
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
                  className="cursor-pointer bg-slate-200 hover:bg-slate-400  rounded py-1 px-1"
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
                  className="cursor-pointer bg-red-300 hover:bg-red-400 rounded py-1 px-1"
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
                  className="cursor-pointer bg-red-700 hover:bg-red-800 text-white rounded py-1 px-1"
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
          <Tooltip>
            <TooltipTrigger>
              <div
                className="cursor-pointer bg-slate-200 hover:bg-slate-400 rounded py-1 px-1"
                onClick={() => deleteNode()}
              >
                <X className="w-4 h-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>delete node</TooltipContent>
          </Tooltip>

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
    <div className="border relative border-dashed border-gray-400  flex justify-center flex-col items-center rounded text-sm text-gray-500">
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="h-10 opacity-0 w-full text-center cursor-pointer"
      />
      <p className=" absolute text-center">Upload image</p>
    </div>
  );
};
