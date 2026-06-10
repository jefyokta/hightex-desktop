import { HighTexDB } from "@/editor/storage/hightex-db";
import { Schema } from "./schema";

export class Importer<TVersion extends SchemaVersion> {
  private db = HighTexDB.getInstance();
  private _scheme?: Schema<TVersion>;

  //   get scheme(){
  //     if (!this._scheme) {
  //         this._scheme;

  //     }

  //   }
  constructor(private file: File) {}
}
