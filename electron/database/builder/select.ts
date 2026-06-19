import { Model } from "../core/model";
import { QueryBuilder } from "./query-builder";

export class Select extends QueryBuilder {
  protected _table: string;
  private _columns: string[] = ["*"];
  private _joins: JoinClause[] = [];
  private _orders: OrderClause[] = [];
  private _groups: string[] = [];
  private _havingClauses: string[] = [];
  private _limit?: number;
  private _offset?: number;
  private _distinct = false;
  private _model!: Model<any>;

  constructor(source: Queryable, columns?: string[]) {
    super();
    this._table = source.getTableName();
    if (columns) this._columns = columns;
  }

  select(...columns: (string | ColAlias)[]): this {
    this._columns = columns.map((e) => {
      return typeof e === "function" ? `${e().actual} AS ${e().alias}` : `${this._table}.${e}`;
    });
    return this;
  }
  first() {
    return this._model;
  }

  distinct(): this {
    this._distinct = true;
    return this;
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

  groupBy(...columns: string[]): this {
    this._groups.push(...columns);
    return this;
  }

  having(raw: string): this {
    this._havingClauses.push(raw);
    return this;
  }

  orderBy(column: string, direction: OrderDirection = "ASC"): this {
    this._orders.push({ column, direction });
    return this;
  }

  orderByDesc(column: string): this {
    return this.orderBy(column, "DESC");
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

    if (this._columns.some((e) => e.includes(" "))) {
      throw new Error("column name cannot has a space");
    }
    const distinct = this._distinct ? "DISTINCT " : "";
    const cols = this._columns.join(", ");
    const joins = this._joins
      .map((j) => `${j.type} JOIN ${j.table} ON ${j.on}`)
      .join(" ");
    const where = this.buildWhere();
    const group = this._groups.length
      ? `GROUP BY ${this._groups.join(", ")}`
      : "";
    const having = this._havingClauses.length
      ? `HAVING ${this._havingClauses.join(" AND ")}`
      : "";
    const order = this._orders.length
      ? `ORDER BY ${this._orders.map((o) => `${o.column} ${o.direction}`).join(", ")}`
      : "";

    let limit = "";
    let offset = "";
    if (this._limit !== undefined) {
      limit = "LIMIT ?";
      this._bindings.push(this._limit);
    }
    if (this._offset !== undefined) {
      offset = "OFFSET ?";
      this._bindings.push(this._offset);
    }
    return [
      `SELECT ${distinct}${cols}`,
      `FROM ${this._table}`,
      joins,
      where,
      group,
      having,
      order,
      limit,
      offset,
    ]
      .filter(Boolean)
      .join(" ");
  }
}
