import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { createCommentClass } from "./utils/custom-element/comment.ts";

const Comment = createCommentClass(document);
if (!window.customElements.get("ht-comment")) {
  window.customElements.define("ht-comment", Comment);
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.ipcRenderer?.on("main-process-message", (_event, message) => {
  console.log(message);
});

window.ipcRenderer?.on("first-installed", (_, data) => console.log(data));
