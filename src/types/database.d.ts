import { Model } from "@main/database/core/model";
import { BelongsToMany, HasMany, Relation } from "@main/database/relation";

declare global {
  interface Queryable<T> {
    getTableName(): string;
    get schemaKeys():(keyof T | "id" | "createdAt")[]
  }

  type Operator =
    | "="
    | "!="
    | ">"
    | "<"
    | ">="
    | "<="
    | "LIKE"
    | "IN"
    | "NOT IN"
    | "IS NULL"
    | "IS NOT NULL";

  interface WhereClause {
    column: string;
    operator: Operator;
    value?: unknown;
    connector: "AND" | "OR";
  }

  type OrderDirection = "ASC" | "DESC";
  type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

  interface JoinClause {
    type: JoinType;
    table: string;
    on: string;
  }

  interface OrderClause {
    column: string;
    direction: OrderDirection;
  }

  type ConflictStrategy = "IGNORE" | "REPLACE";
  type ColAlias = () => { actual: string; alias: string };


  type RelationKeys<TCtor> = keyof RelationsOf<TCtor> & string;

  type RelationMap = Record<string, Relation>;
  type Col<T> = keyof Omit<T, "createdAt"> & string;

  type EntityOf<M> = M extends Model<infer T, any, any> ? T : never;

  type RelationsOf<M> = M extends Model<any, infer R,any> ? R : never;
  
  type ModelCtor<M extends Model<any, any, any> = Model<any, any, any>> = new () => M;  type Selected<T, K extends keyof T> = [K] extends [never] ? T : Pick<T, K>
  type WithJoined<T, TJoined> = T & TJoined;


  type ExtractRelation<T> = T extends Relation<infer M> ? M :never
  type RelationEntity<Rel extends Relation> =
    Rel extends Relation<infer M>
      ? M extends Model<infer E, any, any>
        ? E
        : never
      : never;

type RelationShape<Rel extends Relation> =
  Rel extends { _type: "HasMany" | "BelongsToMany"; model: infer M }
    ? M extends Model<infer E, any, any> ? E[] : never
  : Rel extends { _type: "HasOne" | "BelongsTo"; model: infer M }
    ? M extends Model<infer E, any, any> ? E : never
  : never;
  
type MergeRelation<R extends Record<string, Relation>, K extends keyof R> =
  R[K] extends HasMany<any> | BelongsToMany<any>
    ? { [P in K]: RelationEntity<R[K]>[] }
    : { [P in K]: RelationEntity<R[K]> };

type ShapeOf<M>  = M extends Model<any, any, infer S> ? S : never;

}

export {};