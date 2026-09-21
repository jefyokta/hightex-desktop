import { Model } from "../core/model";
import { BelongsTo } from "../relation";
import { table } from "./../core/schema";
import { Snapshot } from "./snapshot";

type CommentRelation = {
  snapshot: BelongsTo<Snapshot>;
};
export class Comment extends Model<CommentEntity, CommentRelation> {
  protected primaryKeyType = "TEXT" as const;
  protected static TABLENAME: string = 'comments';

  protected _tableName: string =Comment.TABLENAME;
  public get tableName(): string {
    return Comment.TABLENAME;
  }
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
