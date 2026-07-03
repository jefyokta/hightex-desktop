import { QueryBuilder } from "./query-builder";

export class Select<
  TEntity extends Record<string, any> = any,
> extends QueryBuilder<TEntity> {
  private _columns: string[] = [`${this._table}.*`];
  private _joins: JoinClause[] = [];
  private _orders: OrderClause[] = [];
  private _groups: string[] = [];
  private _havings: string[] = [];
  private _limit?: number;
  private _offset?: number;
  private _distinct = false;

  select(...columns: ((keyof TEntity & string) | "*" | ColAlias)[]): this {
    this._columns = columns.map((col) =>
      typeof col === "function"
        ? `${this._table}.${col().actual} AS ${col().alias}`
        : `${this._table}.${col}`,
    );
    return this;
  }

  distinct(): this {
    this._distinct = true;
    return this;
  }
  transformSelected(prefix: string) {
    this._columns = this._columns.flatMap((col) => {
      if (col === `${this._table}.*`) {
        return this._model.schemaKeys.map(
          (key) => `${this._table}.${String(key)} AS ${prefix}__${String(key)}`,
        );
      }

      const match = col.match(/^(.+?)\.(.+?)(?:\s+AS\s+(.+))?$/i);

      if (!match) return col;

      const [, table, column, alias] = match;
      const fieldName = alias ?? column;

      return `${table}.${column} AS ${prefix}__${fieldName}`;
    });
  }

  join(table: string, on: string, type: JoinType = "INNER"): this {
    this._joins.push({ type, table, on });
    return this;
  }

  leftJoin(table: string, on: string): this {
    return this.join(table, on, "LEFT");
  }

  rightJoin(table: string, on: string): this {
    return this.join(table, on, "RIGHT");
  }

  groupBy(...columns: (keyof TEntity & string)[]): this {
    this._groups.push(...columns.map((c) => this._col(c)));
    return this;
  }

  having(raw: string): this {
    this._havings.push(raw);
    return this;
  }

  orderBy(
    col: keyof TEntity & string,
    direction: OrderDirection = "ASC",
  ): this {
    this._orders.push({ column: this._col(col), direction });
    return this;
  }

  asc(col: keyof TEntity & string): this {
    return this.orderBy(col, "ASC");
  }
  desc(col: keyof TEntity & string): this {
    return this.orderBy(col, "DESC");
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }
  offset(n: number): this {
    this._offset = n;
    return this;
  }

  page(page: number, perPage: number): this {
    return this.limit(perPage).offset((page - 1) * perPage);
  }

  toString(): string {
    this._bindings = [];

    const parts: string[] = [
      `SELECT ${this._distinct ? "DISTINCT " : ""}${this._columns.join(", ")}`,
      `FROM ${this._table}`,
    ];

    if (this._joins.length) {
      parts.push(
        this._joins
          .map((j) => `${j.type} JOIN ${j.table} ON ${j.on}`)
          .join(" "),
      );
    }

    const where = this._buildWhere();
    if (where) parts.push(where);

    if (this._groups.length) parts.push(`GROUP BY ${this._groups.join(", ")}`);
    if (this._havings.length)
      parts.push(`HAVING ${this._havings.join(" AND ")}`);

    if (this._orders.length) {
      parts.push(
        `ORDER BY ${this._orders.map((o) => `${o.column} ${o.direction}`).join(", ")}`,
      );
    }

    if (this._limit !== undefined) {
      parts.push("LIMIT ?");
      this._bindings.push(this._limit);
    }
    if (this._offset !== undefined) {
      parts.push("OFFSET ?");
      this._bindings.push(this._offset);
    }

    return parts.join(" ");
  }

  import(builder: QueryBuilder): this {
    super.import(builder);
    if (builder instanceof Select) {
      this._columns = [...this._columns, ...builder._columns];
      this._orders.push(...builder._orders);
      this._joins.push(...builder._joins);
    }
    return this;
  }
}
