import { Model } from "../core/model";
import { BelongsTo } from "../relation";
import { table } from "./../core/schema";
import { Snapshot } from "./snapshot";

type CommentRelation = {
  snapshot: BelongsTo<Snapshot>;
};
export class Comment extends Model<CommentEntity, CommentRelation> {
  protected primaryKeyType = "TEXT" as const;

  protected tableName: string = 'comments';
  protected schema = {
    data: table.json(),
    text: table.text(),
    role: table.text().default("anonymous"),
    participantId: table.text(),
    snapshotId: table.text(),
  };

  static override get relations() {
    return {
      snapshot: this.belongsTo(Snapshot),
    };
  }
}
