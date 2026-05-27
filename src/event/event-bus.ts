export class EventBus {
  private static target = new EventTarget();

  static emit<T = any>(type: string, payload?: T) {
    this.target.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }

  static on<T = any>(type: string, cb: (payload: T) => void | Promise<void>) {
    const handler = async (e: Event) => {
      await cb((e as CustomEvent<T>).detail);
    };

    this.target.addEventListener(type, handler);

    return () => {
      this.target.removeEventListener(type, handler);
    };
  }

  static once<T = any>(type: string, cb: (payload: T) => void) {
    const handler = (e: Event) => {
      cb((e as CustomEvent<T>).detail);
      this.target.removeEventListener(type, handler);
    };

    this.target.addEventListener(type, handler);
  }
}
