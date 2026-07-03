import { QueryBuilder } from "./query-builder";

export class Insert<
  TEntity extends Record<string, any> = any,
> extends QueryBuilder<TEntity> {
  private _rows: Record<string, unknown>[] = [];
  private _onConflict?: ConflictStrategy;

  values(data: Record<string, unknown>): this {
    this._rows.push(data);
    return this;
  }

  bulkValues(rows: Record<string, unknown>[]): this {
    this._rows.push(...rows);
    return this;
  }

  onConflict(strategy: ConflictStrategy): this {
    this._onConflict = strategy;
    return this;
  }

  toString(): string {
    this._bindings = [];

    if (!this._rows.length) throw new Error("Insert: no values provided");

    const keys = Object.keys(this._rows[0]);
    const placeholder = `(${keys.map(() => "?").join(", ")})`;

    this._rows.forEach((row) =>
      keys.forEach((k) => this._bindings.push(this._serialize(row[k]))),
    );

    const modifier = this._onConflict ? ` OR ${this._onConflict}` : "";
    return `INSERT${modifier} INTO ${this._table} (${keys.join(", ")}) VALUES ${this._rows
      .map(() => placeholder)
      .join(", ")}`;
  }

  private _serialize(val: unknown): unknown {
    if (val === null || val === undefined) return null;
    if (typeof val === "boolean") return val ? 1 : 0;
    if (typeof val === "object") return JSON.stringify(val);
    return val;
  }
}

export class Update<
  TEntity extends Record<string, any> = any,
> extends QueryBuilder<TEntity> {
  private _data: Partial<Record<string, unknown>> = {};

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

    if (!Object.keys(this._data).length)
      throw new Error("Update: no data to set");

    const set = Object.entries(this._data)
      .map(([k, v]) => {
        this._bindings.push(v);
        return `${k} = ?`;
      })
      .join(", ");

    return [`UPDATE ${this._table}`, `SET ${set}`, this._buildWhere()]
      .filter(Boolean)
      .join(" ");
  }
}

export class Delete<
  TEntity extends Record<string, any> = any,
> extends QueryBuilder<TEntity> {
  toString(): string {
    this._bindings = [];
    return [`DELETE FROM ${this._table}`, this._buildWhere()]
      .filter(Boolean)
      .join(" ");
  }
}
