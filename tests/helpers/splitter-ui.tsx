import { createRoot } from "react-dom/client";
import { ConfigContextProvider } from "@/context/config-context";
import { Splitter } from "@/pages/splitter";

export function mountSplitterFixture() {
  const host = document.createElement("div");
  host.id = "splitter-fixture";
  document.body.append(host);
  const root = createRoot(host);
  root.render(<ConfigContextProvider><Splitter /></ConfigContextProvider>);
  return () => { root.unmount(); host.remove(); };
}

export function setSplitterFile(index: number, bytes: number[], name: string) {
  const input = document.querySelectorAll<HTMLInputElement>("#splitter-fixture input[type=file]")[index];
  const transfer = new DataTransfer();
  transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/pdf" }));
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
