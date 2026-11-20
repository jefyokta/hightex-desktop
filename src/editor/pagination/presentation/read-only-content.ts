/** On a mounted copy, preserve wrapping selected by editing attributes before removing them. */
export function freezeReadOnlyBoundary(
  element: HTMLElement,
  whiteSpace: string,
) {
  element.style.whiteSpace = whiteSpace;
  element.removeAttribute("contenteditable");
}

export function freezeReadOnlyPresentation(root: HTMLElement, source = root) {
  const elements = [
    source,
    ...source.querySelectorAll<HTMLElement>("[contenteditable]"),
  ];
  const targets =
    source === root
      ? elements
      : [root, ...root.querySelectorAll<HTMLElement>("[contenteditable]")];
  // Read every boundary first: removing a parent's attribute changes the style
  // inherited by nested editable/non-editable content.
  const boundaries = elements.flatMap((element, index) =>
    element.hasAttribute("contenteditable")
      ? [
          {
            element: targets[index],
            whiteSpace: getComputedStyle(element).whiteSpace,
          },
        ]
      : [],
  );
  for (const { element, whiteSpace } of boundaries) {
    freezeReadOnlyBoundary(element, whiteSpace);
  }
  root.inert = true;
}
