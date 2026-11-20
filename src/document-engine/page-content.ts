import type { DocumentPage } from "@/types/document-engine";

export const pageTargets = (page: DocumentPage) =>
  page.targets ??
  Array.from(page.content.querySelectorAll<HTMLElement>("[id]"));
export const pageLinks = (page: DocumentPage) =>
  page.links ??
  Array.from(page.content.querySelectorAll<HTMLAnchorElement>("a[href]"));
