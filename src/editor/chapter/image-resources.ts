import type { DocumentRenderModel } from "@/types/document-snapshot";
import { toBase64 } from "@/utils/is-base-64";
import { archiveSha256 } from "@/utils/htx/import-model";

/** One immutable input owns one URL per referenced image; views only borrow them. */
export class ChapterImageResources {
  private readonly urls = new Map<string, string>();
  private readonly portable = new Map<string, Promise<string | undefined>>();
  private readonly hashes = new Map<string, Promise<string | undefined>>();
  private disposed = false;

  constructor(private readonly images: DocumentRenderModel["images"]) {}

  url(key: string): string | undefined {
    if (this.disposed) throw Error("Chapter image resources are disposed");
    const cached = this.urls.get(key);
    if (cached) return cached;
    const asset = this.images[key];
    if (!asset)
      return /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(key)
        ? key
        : undefined;
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(asset.bytes)], { type: asset.mime }),
    );
    this.urls.set(key, url);
    return url;
  }

  /** Portable resolved bytes can outlive a measuring view, without retaining blob URLs. */
  data(key: string): Promise<string | undefined> {
    if (this.disposed) throw Error("Chapter image resources are disposed");
    let captured = this.portable.get(key);
    if (!captured) {
      const asset = this.images[key];
      captured = asset
        ? toBase64(
            new File([new Uint8Array(asset.bytes)], key, { type: asset.mime }),
          )
        : Promise.resolve(this.url(key));
      this.portable.set(key, captured);
    }
    return captured;
  }

  fingerprint(key: string): Promise<string | undefined> {
    if (this.disposed) throw Error("Chapter image resources are disposed");
    let hash = this.hashes.get(key);
    if (!hash) {
      const asset = this.images[key];
      hash = asset
        ? archiveSha256(asset.bytes).then((value) => `${asset.mime}:${value}`)
        : Promise.resolve(this.url(key));
      this.hashes.set(key, hash);
    }
    return hash;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.portable.clear();
    this.hashes.clear();
  }
}
