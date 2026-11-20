type Listener<T> = (payload: T) => void | Promise<void>;

/** Instance-owned subscriptions with awaited phase hooks and isolated outcome observers. */
export class TypedEmitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<Key extends keyof Events>(type: Key, listener: Listener<Events[Key]>) {
    let listeners = this.listeners.get(type);
    if (!listeners) this.listeners.set(type, (listeners = new Set()));
    listeners.add(listener as Listener<never>);
    return () => this.off(type, listener);
  }

  off<Key extends keyof Events>(type: Key, listener: Listener<Events[Key]>) {
    this.listeners.get(type)?.delete(listener as Listener<never>);
  }

  once<Key extends keyof Events>(type: Key, listener: Listener<Events[Key]>) {
    const off = this.on(type, async (payload) => {
      off();
      await listener(payload);
    });
    return off;
  }

  async emit<Key extends keyof Events>(type: Key, payload: Events[Key]) {
    for (const listener of [...(this.listeners.get(type) ?? [])])
      await (listener as Listener<Events[Key]>)(payload);
  }

  /** Outcome observers start in order, without delaying or changing the completed job. */
  notify<Key extends keyof Events>(
    type: Key,
    payload: Events[Key],
    report: (error: unknown) => void,
  ) {
    const failed = (error: unknown) => {
      try {
        report(error);
      } catch {
        /* Reporting must not replace the outcome either. */
      }
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      try {
        const pending = (listener as Listener<Events[Key]>)(payload);
        if (pending) void Promise.resolve(pending).catch(failed);
      } catch (error) {
        failed(error);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}
