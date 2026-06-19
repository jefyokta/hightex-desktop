import { QueryBuilder } from "./query-builder";

export class Insert extends QueryBuilder {
  protected _table: string;
  private _rows: Record<string, unknown>[] = [];
  private _onConflict?: ConflictStrategy;

  constructor(source: string | Queryable) {
    super();
    this._table = typeof source === "string" ? source : source.getTableName();
  }

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

    if (!this._rows.length) {
      throw new Error("Insert: no values provided");
    }

    const keys = Object.keys(this._rows[0]);
    const columns = keys.join(", ");
    const placeholderRow = `(${keys.map(() => "?").join(", ")})`;
    const placeholders = this._rows.map(() => placeholderRow).join(", ");

    this._rows.forEach((row) => {
      keys.forEach((k) =>
        this._bindings.push(row[k] ? this.parse(row[k]) : null),
      );
    });

    const modifier = this._onConflict ? ` OR ${this._onConflict}` : "";

    return `INSERT${modifier} INTO ${this._table} (${columns}) VALUES ${placeholders}`;
  }
  private parse(val: unknown) {
    if (val && typeof val == "object") {
      return JSON.stringify(val);
    }
    if (typeof val == "boolean") {
      return val ? 1 : 0;
    }

    return val;
  }
}
