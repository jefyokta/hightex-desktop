import { QueryBuilder } from "./query-builder";

export class Unkown extends QueryBuilder {
  constructor(model:Queryable){
    super()
    this._table = model.getTableName()
  }
  toString(): string {
    throw new Error(
      this.constructor.name + "builder cannot be tranform to sql!",
    );
  }
}
