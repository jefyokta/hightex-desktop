import { HighTexDB } from "@/editor/storage/hightex-db";
import { ImageConvertError } from "@/exception/image-convert";

export interface ConvertOptions {
  quality?: number;
  maxDimension?: number;
  maxBytes?: number;
}

const DEFAULTS = {
  quality: 0.85,
  maxDimension: 2400,
  maxBytes: 3 * 1024 * 1024,
} satisfies Required<ConvertOptions>;

export type ImageSource =
  | File
  | Blob
  | string
  | ArrayBuffer
  | ClipboardEvent
  | ClipboardItem[]
  | HTMLImageElement
  | HTMLCanvasElement;

export async function convertImage(
  src: ImageSource,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  const blob = await toWebPBlob(src, opts);
  return HighTexDB.getInstance().saveImage(blob, documentId);
}

export async function fromFile(
  file: File | Blob,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  return HighTexDB.getInstance().saveImage(
    await blobToWebP(file, opts),
    documentId,
  );
}

export async function fromDataUri(
  dataUri: string,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  return fromFile(dataUriToBlob(dataUri), documentId, opts);
}

export async function fromUrl(
  url: string,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  return fromFile(await fetchBlob(url), documentId, opts);
}

export async function fromArrayBuffer(
  buf: ArrayBuffer,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  return fromFile(new Blob([buf]), documentId, opts);
}

export async function fromClipboard(
  event: ClipboardEvent,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string | null> {
  for (const item of Array.from(event.clipboardData?.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file !== null) return fromFile(file, documentId, opts);
    }
  }
  return null;
}

export async function fromClipboardItems(
  items: ClipboardItem[],
  documentId: string,
  opts?: ConvertOptions,
): Promise<string | null> {
  const PREFER = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  for (const item of items) {
    for (const type of PREFER) {
      if (item.types.includes(type))
        return fromFile(await item.getType(type), documentId, opts);
    }
  }
  return null;
}

export async function fromImageElement(
  img: HTMLImageElement,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  if (!img.complete || img.naturalWidth === 0) {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new ImageConvertError("Image element failed to load"));
    });
  }
  const blob = await drawToWebP(
    img,
    img.naturalWidth,
    img.naturalHeight,
    opts?.quality,
  );
  return HighTexDB.getInstance().saveImage(blob, documentId);
}

export async function fromCanvas(
  canvas: HTMLCanvasElement,
  documentId: string,
  opts?: ConvertOptions,
): Promise<string> {
  const blob = await drawToWebP(
    canvas,
    canvas.width,
    canvas.height,
    opts?.quality,
  );
  return HighTexDB.getInstance().saveImage(blob, documentId);
}

async function toWebPBlob(
  src: ImageSource,
  opts?: ConvertOptions,
): Promise<Blob> {
  if (src instanceof File || src instanceof Blob) return blobToWebP(src, opts);
  if (src instanceof ArrayBuffer) return blobToWebP(new Blob([src]), opts);
  if (src instanceof HTMLCanvasElement)
    return drawToWebP(src, src.width, src.height, opts?.quality);
  if (src instanceof HTMLImageElement)
    return drawToWebP(src, src.naturalWidth, src.naturalHeight, opts?.quality);
  if (src instanceof ClipboardEvent) {
    for (const item of Array.from(src.clipboardData?.items ?? [])) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file !== null) return blobToWebP(file, opts);
      }
    }
    throw new ImageConvertError("No image found in ClipboardEvent");
  }
  if (Array.isArray(src)) {
    const PREFER = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    for (const item of src as ClipboardItem[]) {
      for (const type of PREFER) {
        if (item.types.includes(type))
          return blobToWebP(await item.getType(type), opts);
      }
    }
    throw new ImageConvertError("No image found in ClipboardItem[]");
  }
  if (typeof src === "string") {
    const blob = src.startsWith("data:")
      ? dataUriToBlob(src)
      : await fetchBlob(src);
    return blobToWebP(blob, opts);
  }
  throw new ImageConvertError("Unsupported image source type");
}

async function blobToWebP(blob: Blob, opts?: ConvertOptions): Promise<Blob> {
  const quality = opts?.quality ?? DEFAULTS.quality;
  const maxDimension = opts?.maxDimension ?? DEFAULTS.maxDimension;
  const maxBytes = opts?.maxBytes ?? DEFAULTS.maxBytes;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (err) {
    throw new ImageConvertError("Could not decode image bitmap");
  }

  const { w, h } = clampDimensions(bitmap.width, bitmap.height, maxDimension);

  let result = await drawToWebP(bitmap, w, h, quality);

  let q = quality;
  while (result.size > maxBytes && q > 0.3) {
    q = Math.max(0.3, q - 0.05);
    result = await drawToWebP(bitmap, w, h, q);
  }

  bitmap.close();
  return result;
}

async function drawToWebP(
  source: CanvasImageSource,
  w: number,
  h: number,
  quality: number = DEFAULTS.quality,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx === null)
    throw new ImageConvertError("Could not get 2D canvas context");
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b !== null
          ? resolve(b)
          : reject(new ImageConvertError("canvas.toBlob returned null")),
      "image/webp",
      quality,
    ),
  );
}

function clampDimensions(
  sw: number,
  sh: number,
  max: number,
): { w: number; h: number } {
  if (sw <= max && sh <= max) return { w: sw, h: sh };
  const ratio = Math.min(max / sw, max / sh);
  return { w: Math.round(sw * ratio), h: Math.round(sh * ratio) };
}

async function fetchBlob(url: string): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new ImageConvertError(`Failed to fetch: ${url}`);
  }
  if (!res.ok)
    throw new ImageConvertError(`HTTP ${res.status} fetching: ${url}`);
  return res.blob();
}

function dataUriToBlob(dataUri: string): Blob {
  const comma = dataUri.indexOf(",");
  if (comma === -1) throw new ImageConvertError("Malformed data URI");
  const binary = atob(dataUri.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes]);
}
