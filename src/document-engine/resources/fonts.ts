import { t } from "@/utils/lang";
import { abortable } from "@/utils/abortable";

/** Load fonts used by visible chapter text, independently of unrelated UI faces. */
export async function waitForContentFonts(
  root: HTMLElement,
  signal?: AbortSignal,
): Promise<void> {
  const requests = new Map<
    string,
    { family: string; characters: Set<string> }
  >();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim() || !node.parentElement) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (
      !Array.from(range.getClientRects()).some(
        (rect) => rect.width && rect.height,
      )
    )
      continue;
    const style = getComputedStyle(node.parentElement);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let request = requests.get(font);
    if (!request) {
      request = { family: style.fontFamily, characters: new Set() };
      requests.set(font, request);
    }
    for (const character of node.textContent) request.characters.add(character);
  }
  await abortable(
    Promise.all(
      Array.from(requests, async ([font, request]) => {
        try {
          await document.fonts.load(
            font,
            Array.from(request.characters).join(""),
          );
        } catch (cause) {
          throw Object.assign(
            Error(
              t("editor.pagination.pdf_font_failed", { font: request.family }),
            ),
            { cause },
          );
        }
      }),
    ),
    signal,
  );
}
