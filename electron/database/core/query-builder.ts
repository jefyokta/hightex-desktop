import { Model } from "./model";

export class QueryBuilder<TModel extends Model<any>> {
  constructor(_model: TModel) {}
}
