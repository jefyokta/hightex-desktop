export abstract class QueryBuilder {
  protected _wheres: WhereClause[] = [];
  protected _bindings: unknown[] = [];
  protected _table:string=''

  where(col: string, value: unknown): this;
  where(column: string, operator: Operator, value?: unknown): this;
  where(...args: any[]): this {
    if (args.length === 2) {
      this._wheres.push({
        column: this.col(args[0]),
        operator: "=",
        value: args[1],
        connector: "AND",
      });
      return this;
    }
    this._wheres.push({
      column:this.col(args[0]),
      operator: args[1],
      value: args[2],
      connector: "AND",
    });
    return this;
  }
  private col(col:string){
    return `${this._table}.${col}`
  }

  orWhere(col: string, value: unknown): this;
  orWhere(column: string, operator: Operator, value?: unknown): this;
  orWhere(...args: any[]): this {
    if (args.length === 2) {
      this._wheres.push({
        column: args[0],
        operator: "=",
        value: args[1],
        connector: "OR",
      });
      return this;
    }
    this._wheres.push({
      column: args[0],
      operator: args[1],
      value: args[2],
      connector: "OR",
    });
    return this;
  }

  whereIn(column: string, values: unknown[]): this {
    return this.where(column, "IN", values);
  }

  whereNotIn(column: string, values: unknown[]): this {
    return this.where(column, "NOT IN", values);
  }

  whereNull(column: string): this {
    return this.where(column, "IS NULL");
  }

  whereNotNull(column: string): this {
    return this.where(column, "IS NOT NULL");
  }

  whereLike(column: string, pattern: string): this {
    return this.where(column, "LIKE", pattern);
  }

  protected buildWhere(): string {
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
    this.toString();
    return [...this._bindings];
  }

  abstract toString(): string;

  getQuery(): string {
    return this.toString();
  }

  import(builder: QueryBuilder) {
    this._wheres.push(...builder._wheres);
    this._bindings.push(...builder._bindings);

    return this;
  }
}
