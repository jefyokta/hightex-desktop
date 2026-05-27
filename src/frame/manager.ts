export class FrameManager {
  static onMessaged(callback: (message: FrameMessageType) => void) {
    const handler = (event: MessageEvent) => {
      const message = event.data as FrameMessageType;

      if (message && typeof message === "object" && "type" in message) {
        callback(message);
      }
    };

    window.addEventListener("message", handler);

    return () => window.removeEventListener("message", handler);
  }

  static sendMessage<T extends FrameMessageType>(
    type: T["type"],
    data: T["data"],
    targetFrame?: HTMLIFrameElement,
  ) {
    if (targetFrame) {
      targetFrame.contentWindow?.postMessage({ type, data });
      return;
    }
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type, data });
    } else {
      console.warn("FrameManager: Parent window not found.");
    }
  }
}
