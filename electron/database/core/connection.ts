import Database, { type Database as DB } from "better-sqlite3";
import { app } from "electron";
import path from "path";
export class Connection {
  private static db: DB;
  static get() {
    if (!this.db) {
      this.db = new Database(path.join(app.getPath("userData"), "hightex.db"));
    }
    return this.db;
  }
}
