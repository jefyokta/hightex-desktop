import { QueryBuilder } from "./query-builder";

export class Update extends QueryBuilder {
  protected _table: string;
  private _data: Record<string, unknown> = {};

  constructor(source:  Queryable) {
    super();
    this._table = typeof source === "string" ? source : source.getTableName();
  }

  set(data: Record<string, unknown>): this {
    Object.assign(this._data, data);
    return this;
  }
  setValue(column: string, value: unknown): this {
    this._data[column] = value;
    return this;
  }

  toString(): string {
    this._bindings = [];

    if (!Object.keys(this._data).length) {
      throw new Error("Update: no data to set");
    }

    const set = Object.entries(this._data)
      .map(([k, v]) => {
        this._bindings.push(v);
        return `${k} = ?`;
      })
      .join(", ");

    const where = this.buildWhere();

    return [`UPDATE ${this._table}`, `SET ${set}`, where]
      .filter(Boolean)
      .join(" ");
  }
}
