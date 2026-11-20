/** Local destinations are decoded defensively; '#' is an intentional inert fallback. */
export function documentLinkTarget(href: string): string | undefined {
  if (!href.startsWith("#") || href.length === 1) return;
  try { return decodeURIComponent(href.slice(1)) || undefined; }
  catch { return; }
}

/** Normalize authored links without network requests or changing their visible text. */
export function documentLinkHref(value: string | null | undefined): string {
  const href = value?.trim() ?? "";
  if (href === "#") return href;
  if (href.startsWith("#")) return documentLinkTarget(href) ? href : "#";
  try {
    const url = new URL(href);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname) return href;
    if (url.protocol === "mailto:" && url.pathname) return href;
  } catch { /* Malformed authored URLs use the same inert fallback. */ }
  return "#";
}
