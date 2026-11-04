export interface EditorCloseActions {
  dirty(): Promise<boolean>;
  confirm(): Promise<"save" | "discard" | "cancel">;
  save(): Promise<boolean>;
  close(): void;
  lock(locked: boolean): void;
  error(error: unknown): Promise<void>;
}

/** Only an explicit decision, or a clean snapshot, may release the window. */
export class EditorCloseGuard {
  private checking = false;
  private allowed = false;
  constructor(private actions: EditorCloseActions) {}

  request(event: { preventDefault(): void }): void {
    if (this.allowed) return;
    event.preventDefault();
    if (this.checking) return;
    this.checking = true;
    this.actions.lock(true);
    void this.check();
  }

  private async check() {
    try {
      let close = !(await this.actions.dirty());
      if (!close) {
        const choice = await this.actions.confirm();
        close =
          choice === "discard" ||
          (choice === "save" && (await this.actions.save()));
      }
      if (close) {
        this.allowed = true;
        this.actions.close();
      }
    } catch (error) {
      await this.actions.error(error);
    } finally {
      this.checking = false;
      this.actions.lock(false);
    }
  }
}
