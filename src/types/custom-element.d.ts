export {};

declare global {
  interface CommentElement extends HTMLElement {
    addComment(comment: CommentServerMessage): void;
    getComments(): CommentServerMessage[];
  }
}
