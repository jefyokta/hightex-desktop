/** Resolve image sizes before pagination and keep their URLs alive until decoded. */
export async function waitForPrintImages(root: ParentNode): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
      async (image) => {
        if (!image.getAttribute("src")) return;
        try {
          await image.decode();
        } catch {
          throw new Error(
            `Unable to load print image: ${image.getAttribute("src")}`,
          );
        }
      },
    ),
  );
}
