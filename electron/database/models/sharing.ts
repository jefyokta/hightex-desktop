import { Model } from "../core/model";
import { table } from "../core/schema";

export class Sharing extends Model<SharingEntity> {
  protected primaryKeyType = "TEXT" as const;
  protected schema = {
    updatedAt: table.date().nullable(),
    filePath: table.text(),
  };
}
