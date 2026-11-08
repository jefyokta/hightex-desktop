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
  private allowed = false;
  private prepared = false;
  private pending?: Promise<boolean>;
  constructor(private actions: EditorCloseActions) {}

  request(event: { preventDefault(): void }): Promise<boolean> {
    if (this.allowed) return Promise.resolve(true);
    event.preventDefault();
    if (this.prepared) return Promise.resolve(false);
    if (this.pending) return this.pending;
    this.actions.lock(true);
    this.pending = this.check(true).finally(() => {
      this.pending = undefined;
      if (!this.prepared) this.actions.lock(false);
    });
    return this.pending;
  }

  async prepareForWorkspaceSwitch(): Promise<boolean> {
    if (this.allowed || this.prepared) return true;
    if (this.pending) return this.pending;
    this.actions.lock(true);
    this.pending = this.check(false).finally(() => {
      this.pending = undefined;
      if (!this.prepared) this.actions.lock(false);
    });
    return this.pending;
  }

  commitWorkspaceSwitchClose(): boolean {
    if (!this.prepared) return this.allowed;
    this.prepared = false;
    this.allowed = true;
    this.actions.close();
    return true;
  }

  cancelWorkspaceSwitchClose() {
    if (!this.prepared) return;
    this.prepared = false;
    this.actions.lock(false);
  }

  private async check(closeOnApproval: boolean): Promise<boolean> {
    try {
      const dirty = await this.actions.dirty();
      let close = !dirty;
      if (dirty) {
        const choice = await this.actions.confirm();
        close =
          choice === "discard" ||
          (choice === "save" && (await this.actions.save()));
      }
      if (close) {
        if (closeOnApproval) {
          this.allowed = true;
          this.actions.close();
        } else {
          this.prepared = true;
        }
        return true;
      }
      return false;
    } catch (error) {
      await this.actions.error(error);
      return false;
    }
  }
}
