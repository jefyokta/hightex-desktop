/** Resolve image sizes before pagination and keep their URLs alive until decoded. */
export async function waitForPrintImages(
  root: ParentNode,
  signal?: AbortSignal,
  recover?: (image: HTMLImageElement) => void,
): Promise<void> {
  await abortable(
    Promise.all(
      Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
        async (image) => {
          if (!image.getAttribute("src")) return;
          try {
            await image.decode();
          } catch {
            signal?.throwIfAborted();
            if (recover) {
              recover(image);
              await image.decode();
              return;
            }
            const asset = image.getAttribute("data-image-id");
            const owner = image.closest("[id]")?.id;
            const src = image.getAttribute("src")!;
            const resource = src.startsWith("data:")
              ? `${src.slice(0, src.indexOf(",") >= 0 ? src.indexOf(",") : 40)} (${src.length} characters)`
              : src.slice(0, 180);
            throw new Error(
              `Unable to load print image: ${asset ? `asset ${asset}, ` : ""}${owner ? `node #${owner}, ` : ""}${resource}`,
            );
          }
        },
      ),
    ),
    signal,
  );
}
import { abortable } from "@/utils/abortable";
