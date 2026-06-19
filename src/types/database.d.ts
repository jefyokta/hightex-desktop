import { Model } from "@main/database/core/model";

declare global {
  interface Queryable {
    getTableName(): string;
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
  type Relations = Record<
    string,
    {
      model: Model<any>;
      foreignId?: string;
      ownerId?: string;
    }
  >;
}
export {};
