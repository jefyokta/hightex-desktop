import { Model } from "../core/model";
import { table } from "../core/schema";
import { HasMany } from "../relation";
import { Comment } from "./comment";

export type SnapshotRelation = {
  comments: HasMany<Comment>;
};
export class Snapshot extends Model<SnapshotEntity, SnapshotRelation> {
  protected primaryKeyType = "TEXT" as const;
  protected static TABLENAME: string = 'snapshots';
  /**
   * @deprecated
   * @since v0.7.1
   */
  protected _tableName: string = "snapshots";
  protected schema = {
    updatedAt: table.date().nullable(),
    filePath: table.text(),
    documentId: table.text(),
    type: table.text(),
  };
public get tableName(): string {
  return Snapshot.TABLENAME;
}
  static override get relations() {
    return {
      comments: this.hasMany(Comment),
    };
  }
}
