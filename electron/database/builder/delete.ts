import { QueryBuilder } from "./query-builder";

export class Delete extends QueryBuilder {
  protected _table: string;

  constructor(source: string | Queryable) {
    super();
    this._table = typeof source === "string" ? source : source.getTableName();
  }

  toString(): string {
    this._bindings = [];
    const where = this.buildWhere();
    return [`DELETE FROM ${this._table}`, where].filter(Boolean).join(" ");
  }
}
