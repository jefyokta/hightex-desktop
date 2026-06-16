import { Model } from "../core/model";
import { table } from "./../core/schema";

export class Comments extends Model<CommentEntity> {
  protected tableName = "comments";
  protected primaryKeyType = "TEXT" as const;
  protected schema = {
    data: table.json(),
    type: table.text(),
    text: table.text(),
    documentId: table.text(),
    role: table.text().default("anonymous"),
    participantId: table.text(),
  };

  constructor() {
    super();
  }
}
