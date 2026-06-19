import Database from "better-sqlite3";
import { Connection } from "./connection";
import { ColumnDefinition, SchemaBuilder } from "./schema";
import { Grammar } from "./grammar";
import { Select } from "../builder/select";
import { Insert } from "../builder/insert";
import { Delete } from "../builder/delete";
import { Update } from "../builder/update";
import { QueryBuilder } from "../builder/query-builder";
import { Unkown } from "../builder/unknown";

const grammar = new Grammar();

export abstract class Model<
  T extends Record<string, any>,
> implements Queryable {
  protected connection: Database.Database = Connection.get();
  protected serialable = true;
  protected tableName: string =grammar.pluralize(this.constructor.name);
  protected abstract schema: Record<
    keyof Omit<T, "id" | "createdAt">,
    ColumnDefinition
  >;
  protected primaryKeyType: "INTEGER" | "TEXT" = "INTEGER";
  protected attribute: T = {} as T;


  private _select = new Select(this);
  private _insert = new Insert(this);
  private _delete = new Delete(this);
  private _update = new Update(this);
  private _currentBuilder: QueryBuilder = new Unkown(this);
  protected columnMutator: Partial<{ [K in keyof T]: (val: T[K]) => any }> = {};

  protected relations: Relations = {};


  public set<K extends keyof T>(field: K, value: T[K]): this {
    this.attribute[field] = value;
    return this;
  }
  getTableName(): string {
    return this.tableName;
  }

  with(
    relationName: keyof typeof this.relations,
    callback?: (builder: Select) => void,
  ) {
    const relation = this.relations[relationName];
    //@ts-ignore
    const joined = this._select.join(
      relation.model.getTableName(),
      `${this.getTableName()}.${relation.foreignId || String(relation.model.constructor.name).toLowerCase().concat("Id")} = ${relation.model.getTableName()}.${relation.ownerId || "id"}`,
    );
    let relationSelect;
    if (callback) {
      relationSelect = new Select(relation.model);
      callback(relationSelect);
    }
    if(relationSelect){
      joined.import(relationSelect)
    }
    return joined

    // throw new Error("lom siap");
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
  public update(data: Partial<T>) {
    this._update.import(this._currentBuilder);
    this._update.set(data);
    const result = this.connection
      .prepare(String(this._update))
      .run(this._update.getBindings()).changes;
      this.resetQuery()
      return result
  }


  protected resetQuery() {
    this._select = new Select(this)
    this._currentBuilder = new Unkown(this);
    this._update = new Update(this)
    this._insert = new Insert(this)
    this._delete = new Delete(this)
    // this.wheres = [];
    // this.bindings = [];
    // this.orderClause = "";
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
  ) {
    const insert = this._insert.values(data);
    const result =this.connection.prepare(String(insert)).run(insert.getBindings());
    this.resetQuery()
    return result.lastInsertRowid
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
    this._currentBuilder.where(String(col), operator as Operator, value);
    // this.wheres.push(`${String(col)} ${operator} ?`);
    // this.bindings.push(value);
    return this;
  }

  public orderBy(col: keyof T, direction: "ASC" | "DESC" = "DESC"): this {
    // this.orderClause = ` ORDER BY ${String(col)} ${direction}`;
    this._select.orderBy(String(col),direction)
    return this;
  }

  public get(): T[] {
    if (!(this._currentBuilder instanceof Select)) {
      const select =  new Select(this)
       select.import(this._currentBuilder)
       this._currentBuilder = select

    }
    const sql = String(this._currentBuilder);

    const rows = this.connection
      .prepare(sql)
      .all(this._currentBuilder.getBindings());
    this.resetQuery();
    return rows.map((row) => this.parseRowFields(row));
  }

  public first(): T | undefined {
    if (this._currentBuilder instanceof Select) {
      this._currentBuilder.limit(1);
      const row = this.connection
        .prepare(String(this._currentBuilder))
        .get(this._currentBuilder.getBindings());
      this.resetQuery();
      return row ? this.parseRowFields(row) : undefined;
    }

    return undefined;
  }



  public find(id: number | string): T | undefined {
    const pk = String(this.primaryKey());
    const select = this._select.where(pk, id);
    const row = this.connection
      .prepare(String(select))
      .get(...select.getBindings());
    this.resetQuery()
    return row ? this.parseRowFields(row) : undefined;
  }

  public static query<M extends Model<any>>(this: new () => M): M {
    return new this();
  }
  static all<M extends Model<any>>(this: new () => M,col = ["*"]){
    const instance = new this()
    instance._select.select(...col)
    const result =  instance.connection.prepare(instance._select.toString()).all(...instance._select.getBindings())
    //@ts-ignore
   const rows = result.map(e=>instance.parseRowFields(e)) as ReturnType<M['parseRowFields']>[]

   return rows 
  }

  delete() {
    const _delete = this._delete.import(this._currentBuilder);
    const res = this.connection
      .prepare(String(_delete))
      .run(..._delete.getBindings()).changes;
    this.resetQuery()
    return res > 0
  }
}
