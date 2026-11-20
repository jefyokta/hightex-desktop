import React from "react";
import ReactDOM from "react-dom/client";
import { createCommentClass } from "./utils/custom-element/comment.ts";
import { LocaleProvider } from "./context/locale-context";

// The print host paints a frozen snapshot; loading editor/dashboard routes here
// adds startup work without contributing to document layout.
const App = React.lazy(() => import("./App.tsx"));
const Print = React.lazy(() => import("./pages/editor-pdf-print").then(module => ({ default: module.EditorPDFPrint })));
const printing = window.location.pathname === "/experimental/editor-pdf/print";

const Comment = createCommentClass(document);
if (!window.customElements.get("ht-comment")) {
  window.customElements.define("ht-comment", Comment);
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <React.Suspense fallback={null}>
        {printing ? <Print /> : <App />}
      </React.Suspense>
    </LocaleProvider>
  </React.StrictMode>,
);
