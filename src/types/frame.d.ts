export {};

declare global {
  type FrameMessageMap = {
    "node:clicked": { uuid: string; type?: string };
    "page:overflow": { page: number };
    "preview:zoom": { zoom: number };
    "page:rendered": { totalPages: number };
    "page:requested": { pageId: string };
    "layout:error": { node?: undefined };
  };

  type FrameMessageType = {
    [K in keyof FrameMessageMap]: {
      type: K;
      data: FrameMessageMap[K];
    };
  }[keyof FrameMessageMap];
}
