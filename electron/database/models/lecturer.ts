import { Model } from "../core/model";
import { table } from "../core/schema";

export class LocalLecturer extends Model<LecturerEntity> {
  protected primaryKeyType = "TEXT" as const;
  protected static readonly TABLENAME = "local_lecturers";
  protected _tableName = LocalLecturer.TABLENAME;

  override get tableName(): string {
    return LocalLecturer.TABLENAME;
  }

  protected schema = {
    name: table.text(),
    nip: table.text().default(""),
    source_type: table.text().default("unknown"),
    source_detail: table.text().nullable(),
  };

  protected indexes = [table.index("name"), table.index("nip")];
}
