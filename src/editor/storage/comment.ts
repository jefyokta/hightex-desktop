import { useIPC } from "@/hooks/use-ipc";
export class CommentStorage {
  private set: Set<CommentEntity>;

  private static _instance?: CommentStorage;

  public static get instance() {
    if (!this._instance) {
      this._instance = new CommentStorage();
    }
    return this._instance;
  }
  private constructor() {
    this.set = new Set();
  }

  static async create(snapshotId: string) {
    const snap = await useIPC("hightex").hightex.snapshot.get(snapshotId);
    const comments = snap?.comments || [];

    for (const comment of comments) {
      this.instance.set.add(comment);
    }
  }
  all() {
    return Array.from(this.set);
  }

  recreate() {
    this.set = new Set();
  }
}
