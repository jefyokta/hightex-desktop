export function registerHandlers(...args: Handlers[]): void;
export function initializeHandlers(
  chunker: any,
  polisher: any,
  caller: any,
): Handlers;
export let registeredHandlers: (
  | typeof import("pagedjs/src/modules/filters/comments.js").default
  | typeof import("pagedjs/src/modules/generated-content/running-headers.js").default
  | typeof import("pagedjs/src/modules/generated-content/string-sets.js").default
  | typeof import("pagedjs/src/modules/generated-content/target-counters.js").default
  | typeof import("pagedjs/src/modules/generated-content/target-text.js").default
  | typeof import("pagedjs/src/modules/paged-media/atpage.js").default
  | typeof import("pagedjs/src/modules/paged-media/breaks.js").default
  | typeof import("pagedjs/src/modules/paged-media/counters.js").default
  | typeof import("pagedjs/src/modules/paged-media/following.js").default
  | typeof import("pagedjs/src/modules/paged-media/print-media.js").default
  | typeof import("pagedjs/src/modules/paged-media/splits.js").default
  | typeof import("pagedjs/src/modules/paged-media/lists.js").default
  | typeof import("pagedjs/src/modules/paged-media/position-fixed.js").default
  | typeof import("pagedjs/src/modules/paged-media/page-counter-increment.js").default
)[];
export class Handlers {
  constructor(chunker: any, polisher: any, caller: any);
}
