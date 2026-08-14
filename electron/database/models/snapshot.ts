import { Model } from "../core/model";
import { table } from "../core/schema";
import { HasMany } from "../relation";
import { Comment } from "./comment";

type SnapshotRelation = {
  comments: HasMany<Comment>;
};
export class Snapshot extends Model<SnapshotEntity, SnapshotRelation> {
  protected primaryKeyType = "TEXT" as const;
  protected tableName: string = 'snapshots';
  protected schema = {
    updatedAt: table.date().nullable(),
    filePath: table.text(),
    documentId: table.text(),
    type: table.text(),
  };

  static override get relations() {
    return {
      comments: this.hasMany(Comment),
    };
  }
}
