import Database from "better-sqlite3";
import { Connection } from "./connection";
import { ColumnDefinition, SchemaBuilder } from "./schema";

export abstract class Model<T extends Record<string, any>> {
  protected connection: Database.Database = Connection.get();
  protected serialable = true;
  protected abstract tableName: string;
  protected abstract schema: Record<
    keyof Omit<T, "id" | "createdAt">,
    ColumnDefinition
  >;
  protected primaryKeyType: "INTEGER" | "TEXT" = "INTEGER";
  protected attribute: T = {} as T;

  protected bindings: any[] = [];
  protected wheres: string[] = [];
  protected orderClause: string = "";

  protected columnMutator: Partial<{ [K in keyof T]: (val: T[K]) => any }> = {};

  public set<K extends keyof T>(field: K, value: T[K]): this {
    this.attribute[field] = value;
    return this;
  }

  protected mutate<K extends keyof T>(key: K, callback: (val: T[K]) => any) {
    this.columnMutator[key] = callback;
  }

  public save() {
    this.create(this.attribute);
    this.attribute = {} as T;
  }
  public primaryKey(): keyof T {
    return "id" as keyof T;
  }

  public toString(): string {
    const fields = Object.keys(this.schema).join(", ");
    return `[Model: ${this.constructor.name}] { table: "${this.tableName}", primaryKey: "${String(this.primaryKey())}" (${this.primaryKeyType}), fields: [id, ${fields}, createdAt] }`;
  }

  protected resetQuery() {
    this.wheres = [];
    this.bindings = [];
    this.orderClause = "";
  }

  readonly boot = (): void => {
    const columnsSql = SchemaBuilder.compile(
      this.schema,
      String(this.primaryKey()),
      this.primaryKeyType,
    );

    const sql = `CREATE TABLE IF NOT EXISTS ${this.tableName} (${columnsSql})`;
    this.connection.prepare(sql).run();
  };

  public create(
    data: Omit<T, "id" | "createdAt"> & { id?: string | number },
  ): Database.RunResult {
    const keys = Object.keys(data);
    const columns = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");

    const values = Object.values(data).map((value) => {
      if (value !== null && typeof value === "object") {
        return JSON.stringify(value);
      }
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      return value;
    });

    const sql = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    return this.connection.prepare(sql).run(values);
  }

  protected parseRowFields(row: any): T {
    if (!row) return row;

    for (const [columnName, def] of Object.entries(this.schema)) {
      if (row[columnName] !== undefined && row[columnName] !== null) {
        if (this.columnMutator[columnName]) {
          row[columnName] = this.columnMutator[columnName](row[columnName]);
          continue;
        }
        if (def.colType === "JSON" && typeof row[columnName] === "string") {
          try {
            row[columnName] = JSON.parse(row[columnName]);
          } catch (e) {}
        }
        if (
          def.colType === "DATE" &&
          typeof row[columnName] === "string" &&
          !this.serialable
        ) {
          try {
            row[columnName] = new Date(row[columnName]);
          } catch (error) {}
        }
        if (def.colType === "BOOLEAN") {
          row[columnName] = row[columnName] === 1;
        }
      }
    }
    if (!this.serialable) {
      row["createdAt"] = new Date(row["createdAt"]);
    }
    return row as T;
  }

  public where(
    col: keyof T,
    operator: "=" | ">" | "<" | ">=" | "<=" | "LIKE",
    value: any,
  ): this;
  public where(col: keyof T, value: any): this;
  public where(col: keyof T, arg2: any, arg3?: any): this {
    let operator = "=";
    let value = arg2;
    if (arg3 !== undefined) {
      operator = arg2;
      value = arg3;
    }

    if (value !== null && typeof value === "object") {
      value = JSON.stringify(value);
    }
    if (typeof value === "boolean") {
      value = value ? 1 : 0;
    }

    this.wheres.push(`${String(col)} ${operator} ?`);
    this.bindings.push(value);
    return this;
  }

  public orderBy(col: keyof T, direction: "ASC" | "DESC" = "DESC"): this {
    this.orderClause = ` ORDER BY ${String(col)} ${direction}`;
    return this;
  }

  public get(): T[] {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (this.wheres.length > 0) sql += ` WHERE ${this.wheres.join(" AND ")}`;
    if (this.orderClause) sql += this.orderClause;

    const rows = this.connection.prepare(sql).all(this.bindings);
    this.resetQuery();
    return rows.map((row) => this.parseRowFields(row));
  }

  public first(): T | undefined {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (this.wheres.length > 0) sql += ` WHERE ${this.wheres.join(" AND ")}`;
    if (this.orderClause) sql += this.orderClause;
    sql += ` LIMIT 1`;

    const row = this.connection.prepare(sql).get(this.bindings);
    this.resetQuery();
    return row ? this.parseRowFields(row) : undefined;
  }

  public all(): T[] {
    const rows = this.connection
      .prepare(`SELECT * FROM ${this.tableName} ORDER BY createdAt DESC`)
      .all();
    return rows.map((row) => this.parseRowFields(row));
  }

  public find(id: number | string): T | undefined {
    const pk = String(this.primaryKey());
    const row = this.connection
      .prepare(`SELECT * FROM ${this.tableName} WHERE ${pk} = ?`)
      .get(id);
    return row ? this.parseRowFields(row) : undefined;
  }

  public static query<M extends Model<any>>(this: new () => M): M {
    return new this();
  }
}
