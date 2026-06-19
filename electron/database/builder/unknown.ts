import { QueryBuilder } from "./query-builder";

export class Unkown extends QueryBuilder {

  toString(): string {
    throw new Error(
      this.constructor.name + "builder cannot be tranform to sql!",
    );
  }
}
