export function createCommentClass(doc: Document) {
  const win = doc.defaultView!;
  const HTMLElementBase = win.HTMLElement;
  type Value = CommentMessage<"server">["payload"];
  return class CommentMarker extends HTMLElementBase {
    private comments = new Set<Value>();
    private defaultStyle: Partial<CSSStyleDeclaration> = {
      display: "inline",
      cursor: "pointer",
      mixBlendMode: "multiply",
    };
    connectedCallback() {
      Object.assign(this.style, this.defaultStyle);
      this.classList.add("commented");

      queueMicrotask(() => {
        const parent = this.parentElement?.closest(
          "ht-comment",
        ) as CommentMarker | null;

        if (parent) {
          for (const com of parent.getComments()) {
            this.comments.add(com);
          }
        }
      });
    }

    addComment(comment: Value) {
      this.comments.add(comment);
      this.dataset.comments = [...this.comments].join(",");
    }

    getComments() {
      return [...this.comments];
    }
  };
}
