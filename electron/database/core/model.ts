import Database from "better-sqlite3";
import { Connection } from "./connection";
import { ColumnDefinition, SchemaBuilder } from "./schema";
import { Grammar } from "../builder/grammar";
import { Select } from "../builder/select";
import { Insert, Update, Delete } from "../builder/mutations";
import {
  Relation,
  BelongsTo,
  HasOne,
  HasMany,
  BelongsToMany,
} from "../relation";

const grammar = new Grammar();

type UnwrapModel<M> = M extends Model<infer E, any, any> ? E : never;

type RelationShape<Rel extends Relation> =
  Rel extends HasMany<infer M>
    ? UnwrapModel<M>[]
    : Rel extends BelongsToMany<infer M>
      ? UnwrapModel<M>[]
      : Rel extends HasOne<infer M>
        ? UnwrapModel<M>
        : Rel extends BelongsTo<infer M>
          ? UnwrapModel<M>
          : never;

type WithRelation<
  TShape extends Record<string, any>,
  R extends Record<string, Relation>,
  K extends keyof R,
> = TShape & { [P in K]: RelationShape<R[P]> };

export abstract class Model<
  T extends Record<string, any>,
  R extends Record<string, Relation> = {},
  TShape extends Record<string, any> = T,
> implements Queryable<T> {
  protected static relations: Record<string, Relation> = {};

  protected connection: Database.Database = Connection.get();
  protected tableName: string = grammar.pluralize(this.constructor.name);
  protected primaryKeyType: "INTEGER" | "TEXT" = "INTEGER";
  protected serialable = true;
  protected columnMutator: Partial<Record<Col<T>, (val: any) => any>> = {};

  protected abstract schema: Record<
    keyof Omit<T, "id" | "createdAt">,
    ColumnDefinition
  >;

  protected attribute: Partial<T> = {};

  private _select!: Select<T>;
  private _insert!: Insert<T>;
  private _update!: Update<T>;
  private _delete!: Delete<T>;
  private _loadedRelations: Map<string, Relation> = new Map();

  constructor() {
    this._resetBuilders();
  }

  private _resetBuilders(): void {
    this._select = new Select<T>(this);
    this._insert = new Insert<T>(this);
    this._update = new Update<T>(this);
    this._delete = new Delete<T>(this);
    this._loadedRelations = new Map();
  }

  getTableName(): string {
    return this.tableName;
  }
  primaryKey(): Col<T> {
    return "id" as Col<T>;
  }

  set<K extends keyof T>(field: K, value: T[K]): this {
    this.attribute[field] = value;
    return this;
  }

  readonly boot = (): void => {
    const cols = SchemaBuilder.compile(
      this.schema,
      this.primaryKey(),
      this.primaryKeyType,
    );
    this.connection
      .prepare(`CREATE TABLE IF NOT EXISTS ${this.tableName} (${cols})`)
      .run();
  };

  with<K extends keyof R & string>(
    relationName: K,
    callback?: (query: Select<UnwrapModel<R[K]["model"]>>) => void,
  ): Model<T, R, WithRelation<TShape, R, K>> {
    const ctor = this.constructor as typeof Model;
    const relation = (ctor.relations as R)[relationName];

    if (!relation)
      throw new Error(`Relation "${relationName}" not defined on ${ctor.name}`);

    this._loadedRelations.set(relationName, relation);
    this._applyJoin(relation);

    if (callback) {
      const sub = new Select<UnwrapModel<R[K]["model"]>>(
        relation.model as unknown as Queryable<UnwrapModel<R[K]["model"]>>,
      );
      callback(sub);
      sub.transformSelected(relationName);
      this._select.import(sub);
    }

    return this as unknown as Model<T, R, WithRelation<TShape, R, K>>;
  }

  private _applyJoin(relation: Relation): void {
    const self = this.tableName;
    const other = (relation.model as unknown as Queryable<any>).getTableName();
    const pk = this.primaryKey();

    if (relation instanceof BelongsTo) {
      const fk = relation.foreignId ?? `${other}Id`;
      const own = relation.ownerId ?? "id";
      this._select.join(other, `${self}.${fk} = ${other}.${own}`);
    } else if (relation instanceof HasOne) {
      const own = relation.ownerId ?? pk;
      const fk =
        relation.foreignId ?? `${this.constructor.name.toLowerCase()}Id`;
      this._select.join(other, `${self}.${own} = ${other}.${fk}`);
    } else if (relation instanceof HasMany) {
      const own = relation.ownerId ?? pk;
      const fk =
        relation.foreignId ?? `${this.constructor.name.toLowerCase()}Id`;
      this._select.leftJoin(other, `${self}.${own} = ${other}.${fk}`);
    } else if (relation instanceof BelongsToMany) {
      const pivot = relation.pivotTable;
      this._select
        .join(pivot, `${self}.${pk} = ${pivot}.${relation.pivotForeignKey}`)
        .join(other, `${pivot}.${relation.pivotRelatedKey} = ${other}.id`);
    }
  }

  where<K extends Col<T>>(col: K, value: T[K]): this;
  where<K extends Col<T>>(col: K, operator: Operator, value: T[K]): this;
  where(col: Col<T>, arg2: any, arg3?: any): this {
    const [op, val] = arg3 !== undefined ? [arg2, arg3] : ["=", arg2];
    const v = this._normalize(val);
    this._select.where(col, op, v);
    this._update.where(col, op, v);
    this._delete.where(col, op, v);
    return this;
  }

  orderBy(col: Col<T>, direction: "ASC" | "DESC" = "DESC"): this {
    this._select.orderBy(col, direction);
    return this;
  }

  limit(n: number): this {
    this._select.limit(n);
    return this;
  }
  offset(n: number): this {
    this._select.offset(n);
    return this;
  }

  page(page: number, perPage: number): this {
    return this.limit(perPage).offset((page - 1) * perPage);
  }

  get(): TShape[] {
    const rows = this.connection
      .prepare(this._select.toString())
      .all(this._select.getBindings()) as any[];
    const loaded = new Map(this._loadedRelations);
    this._resetBuilders();
    return this._hydrateRows(rows, loaded) as unknown as TShape[];
  }

  first(): TShape | undefined {
    this._select.limit(1);
    const rows = this.connection
      .prepare(this._select.toString())
      .all(this._select.getBindings()) as any[];
    const loaded = new Map(this._loadedRelations);
    this._resetBuilders();
    return this._hydrateRows(rows, loaded)[0] as unknown as TShape | undefined;
  }

  find(id: number | string): TShape | undefined {
    this._select.where(this.primaryKey(), id);
    const rows = this.connection
      .prepare(this._select.toString())
      .all(this._select.getBindings()) as any[];
    const loaded = new Map(this._loadedRelations);
    this._resetBuilders();
    return this._hydrateRows(rows, loaded)[0] as unknown as TShape | undefined;
  }

  create(
    data: Omit<T, "id" | "createdAt"> & { id?: string | number },
  ): T | undefined {
    const insert = this._insert
      .values(data as Record<string, unknown>)
      .onConflict("REPLACE");
    const result = this.connection
      .prepare(insert.toString())
      .run(insert.getBindings());
    this._resetBuilders();
    return new (this.constructor as new () => this)().find(
      result.lastInsertRowid as any,
    ) as unknown as T;
  }

  save(): void {
    this.create(this.attribute as any);
    this.attribute = {};
  }

  update(data: Partial<Omit<T, "id" | "createdAt">>): number {
    this._update.set(data as Record<string, unknown>);
    const changes = this.connection
      .prepare(this._update.toString())
      .run(this._update.getBindings()).changes;
    this._resetBuilders();
    return changes;
  }

  put(data: T): T | undefined {
    this._insert.values(data).onConflict("REPLACE");
    const id = this.connection
      .prepare(this._insert.toString())
      .run(this._insert.getBindings()).lastInsertRowid;
    this._resetBuilders();
    return new (this.constructor as new () => this)().find(
      id as any,
    ) as unknown as T;
  }

  delete(): boolean {
    const changes = this.connection
      .prepare(this._delete.toString())
      .run(this._delete.getBindings()).changes;
    this._resetBuilders();
    return changes > 0;
  }

  static query<M extends Model<any, any, any>>(this: ModelCtor<M>): M {
    return new this();
  }

  static all<M extends Model<any, any, any>>(
    this: ModelCtor<M>,
    columns?: Col<EntityOf<M>>[],
  ): ShapeOf<M>[] {
    const inst = new this();
    if (columns?.length) inst._select.select(...columns);
    return inst.get() as unknown as ShapeOf<M>[];
  }

  static find<M extends Model<any, any, any>>(
    this: new () => M,
    id: number | string,
  ): ShapeOf<M> | undefined {
    return new this().find(id) as ShapeOf<M> | undefined;
  }

  static where<M extends Model<any, any, any>, K extends Col<EntityOf<M>>>(
    this: ModelCtor<M>,
    col: K,
    value: EntityOf<M>[K],
  ): M;
  static where<M extends Model<any, any, any>, K extends Col<EntityOf<M>>>(
    this: ModelCtor<M>,
    col: K,
    operator: Operator,
    value: EntityOf<M>[K],
  ): M;
  static where<M extends Model<any, any, any>>(
    this: ModelCtor<M>,
    col: Col<EntityOf<M>>,
    arg2: any,
    arg3?: any,
  ): M {
    return new this().where(col, arg2, arg3) as M;
  }

  static with<
    M extends Model<any, any, any>,
    K extends keyof RelationsOf<M> & string,
  >(
    this: ModelCtor<M>,
    relationName: K,
    callback?: (query: Select<UnwrapModel<RelationsOf<M>[K]["model"]>>) => void,
  ): Model<
    ShapeOf<M>,
    RelationsOf<M>,
    WithRelation<ShapeOf<M>, RelationsOf<M>, K>
  > {
    return new this().with(relationName, callback);
  }

  static belongsTo<TModel extends Model<any, any, any>>(
    model: new () => TModel,
    foreignId?: string,
    ownerId?: string,
  ): BelongsTo<TModel> {
    return new BelongsTo<TModel>(new model(), foreignId, ownerId);
  }

  static hasOne<TModel extends Model<any, any, any>>(
    model: new () => TModel,
    foreignId?: string,
    ownerId?: string,
  ): HasOne<TModel> {
    return new HasOne<TModel>(new model(), foreignId, ownerId);
  }

  static hasMany<TModel extends Model<any, any, any>>(
    model: new () => TModel,
    foreignId?: string,
    ownerId?: string,
  ): HasMany<TModel> {
    return new HasMany<TModel>(new model(), foreignId, ownerId);
  }

  static belongsToMany<TModel extends Model<any, any, any>>(
    model: new () => TModel,
    pivotTable: string,
    pivotForeignKey: string,
    pivotRelatedKey: string,
  ): BelongsToMany<TModel> {
    return new BelongsToMany<TModel>(
      new model(),
      pivotTable,
      pivotForeignKey,
      pivotRelatedKey,
    );
  }
  static raw(this: new () => Model<any>, sql: string, bindings = []) {
    const instance = new this();
    return instance.connection.prepare(sql).bind(bindings);
  }

  private _hydrateRows(
    rows: Record<string, any>[],
    loaded: Map<string, Relation>,
  ): T[] {
    if (rows.length === 0) return [];

    const manyNames = new Set(
      [...loaded.entries()]
        .filter(([, r]) => r instanceof HasMany || r instanceof BelongsToMany)
        .map(([k]) => k),
    );

    if (manyNames.size === 0) {
      return rows.map((r) => this._parseRow(r, loaded));
    }

    const pk = this.primaryKey() as string;
    const map = new Map<any, Record<string, any>>();

    for (const raw of rows) {
      const id = raw[pk];

      if (!map.has(id)) {
        const base: Record<string, any> = {};
        for (const key of Object.keys(raw)) {
          if (!manyNames.has(key.split("__")[0])) base[key] = raw[key];
        }
        for (const name of manyNames) base[name] = [];
        map.set(id, base);
      }

      const parent = map.get(id)!;

      for (const name of manyNames) {
        const relation = loaded.get(name)!;
        const related = this._extractPrefixed(raw, name);
        if (!related || this._isNullRow(related)) continue;
        const already = parent[name] as any[];
        const relId = related["id"];
        if (relId == null || !already.some((x) => x["id"] === relId)) {
          already.push((relation.model as Model<any>)._parseRow(related));
        }
      }
    }

    return [...map.values()].map((r) => this._parseRow(r, loaded, manyNames));
  }
  private _extractPrefixed(
    row: Record<string, any>,
    prefix: string,
  ): Record<string, any> | null {
    const result: Record<string, any> = {};
    let found = false;
    for (const key of Object.keys(row)) {
      if (key.startsWith(`${prefix}__`)) {
        result[key.slice(prefix.length + 2)] = row[key];
        found = true;
      }
    }
    return found ? result : null;
  }

  private _isNullRow(obj: Record<string, any>): boolean {
    return Object.values(obj).every((v) => v == null);
  }

  protected _parseRow(
    row: Record<string, any>,
    loaded: Map<string, Relation> = new Map(),
    skipRelations: Set<string> = new Set(),
  ): T {
    for (const [col, def] of Object.entries(this.schema)) {
      const val = row[col];
      if (val === undefined || val === null) continue;

      const mutator = this.columnMutator[col as Col<T>];
      if (mutator) {
        row[col] = mutator(val);
        continue;
      }

      if (def.colType === "JSON" && typeof val === "string") {
        try {
          row[col] = JSON.parse(val);
        } catch {}
      } else if (def.colType === "BOOLEAN") {
        row[col] = val === 1;
      } else if (
        def.colType === "DATE" &&
        typeof val === "string" &&
        !this.serialable
      ) {
        try {
          row[col] = new Date(val);
        } catch {}
      }
    }

    if (!this.serialable && row["createdAt"]) {
      row["createdAt"] = new Date(row["createdAt"]);
    }
    const singleNames = new Set(
      [...loaded.entries()]
        .filter(([, r]) => r instanceof BelongsTo || r instanceof HasOne)
        .map(([k]) => k),
    );

    for (const key of Object.keys(row)) {
      if (!key.includes("__")) continue;
      const [name, col] = key.split("__");
      if (!singleNames.has(name)) continue;
      if (!row[name]) row[name] = {};
      row[name][col] = row[key];
      delete row[key];
    }

    for (const name of singleNames) {
      if (!row[name] || skipRelations.has(name)) continue;
      row[name] = (loaded.get(name)!.model as Model<any>)._parseRow(row[name]);
    }

    return row as T;
  }

  private _normalize(value: unknown): unknown {
    if (value !== null && typeof value === "object")
      return JSON.stringify(value);
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
  }

  get schemaKeys() {
    return [...Object.keys(this.schema), "id", "createdAt"] as (
      | keyof T
      | "id"
      | "createdAt"
    )[];
  }
}
