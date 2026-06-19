import { QueryBuilder } from "./query-builder";

export class Delete extends QueryBuilder {
  toString(): string {
    this._bindings = [];
    const where = this.buildWhere();
    return [`DELETE FROM ${this._table}`, where].filter(Boolean).join(" ");
  }
}
