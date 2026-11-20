import { formatBibliography } from "@/utils/citation";

/** Shared bibliography markup; input resolution belongs to each caller. */
export function bibliographyContent(entries: readonly string[]): HTMLElement {
  const root = document.createElement("section");
  const header = document.createElement("h1");
  root.classList.add("content", "static-chapter");
  header.textContent = "DAFTAR PUSTAKA";
  header.style.fontSize = "14pt";
  header.id = "biblio";
  header.style.fontWeight = "700";
  header.style.textAlign = "center";
  header.style.marginBottom = "10pt";
  header.style.marginTop = "10pt";
  root.append(header);
  const wrapper = document.createElement("div");
  wrapper.innerHTML = formatBibliography(entries);
  root.append(wrapper);
  return root;
}
