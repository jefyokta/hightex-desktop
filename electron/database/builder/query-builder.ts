export abstract class QueryBuilder<TEntity extends Record<string, any> = any> {
  protected _wheres: WhereClause[] = [];
  protected _bindings: unknown[] = [];
  protected _table: string = "";
  protected _model: Queryable<TEntity>;

  constructor(model: Queryable<TEntity>) {
    this._table = model.getTableName();
    this._model = model;
  }

  where(col: keyof TEntity & string, value: unknown): this;
  where(col: keyof TEntity & string, operator: Operator, value: unknown): this;
  where(col: string, arg2: unknown, arg3?: unknown): this {
    const [operator, value]: [Operator, unknown] =
      arg3 !== undefined ? [arg2 as Operator, arg3] : ["=", arg2];
    this._wheres.push({
      column: this._col(col),
      operator,
      value,
      connector: "AND",
    });
    return this;
  }

  orWhere(col: keyof TEntity & string, value: unknown): this;
  orWhere(
    col: keyof TEntity & string,
    operator: Operator,
    value: unknown,
  ): this;
  orWhere(col: string, arg2: unknown, arg3?: unknown): this {
    const [operator, value]: [Operator, unknown] =
      arg3 !== undefined ? [arg2 as Operator, arg3] : ["=", arg2];
    this._wheres.push({
      column: this._col(col),
      operator,
      value,
      connector: "OR",
    });
    return this;
  }

  whereIn(col: keyof TEntity & string, values: unknown[]): this {
    return this.where(col, "IN", values);
  }

  whereNotIn(col: keyof TEntity & string, values: unknown[]): this {
    return this.where(col, "NOT IN", values);
  }

  whereNull(col: keyof TEntity & string): this {
    this._wheres.push({
      column: this._col(col),
      operator: "IS NULL",
      value: undefined,
      connector: "AND",
    });
    return this;
  }

  whereNotNull(col: keyof TEntity & string): this {
    this._wheres.push({
      column: this._col(col),
      operator: "IS NOT NULL",
      value: undefined,
      connector: "AND",
    });
    return this;
  }

  whereLike(col: keyof TEntity & string, pattern: string): this {
    return this.where(col, "LIKE", pattern);
  }

  protected _col(col: string): string {
    return col.includes(".") ? col : `${this._table}.${col}`;
  }

  protected _buildWhere(): string {
    if (!this._wheres.length) return "";

    return this._wheres
      .map((w, i) => {
        const prefix = i === 0 ? "WHERE" : w.connector;

        if (w.operator === "IS NULL" || w.operator === "IS NOT NULL") {
          return `${prefix} ${w.column} ${w.operator}`;
        }

        if (w.operator === "IN" || w.operator === "NOT IN") {
          const arr = w.value as unknown[];
          arr.forEach((v) => this._bindings.push(v));
          return `${prefix} ${w.column} ${w.operator} (${arr.map(() => "?").join(", ")})`;
        }

        this._bindings.push(w.value);
        return `${prefix} ${w.column} ${w.operator} ?`;
      })
      .join(" ");
  }

  getBindings(): unknown[] {
    this._bindings = [];
    this.toString();
    return [...this._bindings];
  }

  import(builder: QueryBuilder): this {
    this._wheres.push(...builder._wheres);
    return this;
  }

  abstract toString(): string;

  toSql() {
    return this.toString();
  }
}
