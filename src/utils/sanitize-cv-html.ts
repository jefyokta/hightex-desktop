export const sanitizeCvHtml = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed
    .querySelectorAll(
      "script, style, iframe, object, embed, link, meta, template",
    )
    .forEach((element) => element.remove());
  const allowed = new Set([
    "P",
    "DIV",
    "SPAN",
    "BR",
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "S",
    "SUB",
    "SUP",
  ]);
  parsed.body.querySelectorAll("*").forEach((element) => {
    if (!allowed.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }
    Array.from(element.attributes).forEach((attribute) =>
      element.removeAttribute(attribute.name),
    );
  });
  return parsed.body.innerHTML;
};
