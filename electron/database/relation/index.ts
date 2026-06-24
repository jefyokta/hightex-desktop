import { Model } from "../core/model";

export abstract class Relation<TModel extends Model<any, any> = Model<any, any>> {
  abstract readonly _type: string;
  constructor(
    public readonly model: TModel,
    public readonly foreignId?: string,
    public readonly ownerId?: string,
  ) {}
}

export class BelongsTo<TModel extends Model<any, any> = Model<any, any>> extends Relation<TModel> {
  readonly _type = "BelongsTo" as const;
}

export class HasOne<TModel extends Model<any, any> = Model<any, any>> extends Relation<TModel> {
  readonly _type = "HasOne" as const;
}

export class HasMany<TModel extends Model<any, any> = Model<any, any>> extends Relation<TModel> {
  readonly _type = "HasMany" as const;
}

export class BelongsToMany<TModel extends Model<any, any> = Model<any, any>> extends Relation<TModel> {
  readonly _type = "BelongsToMany" as const;
  constructor(
    model: TModel,
    public readonly pivotTable: string,
    public readonly pivotForeignKey: string,
    public readonly pivotRelatedKey: string,
  ) {
    super(model);
  }
}