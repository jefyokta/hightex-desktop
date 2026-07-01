import { Model } from "../core/model";
import { table } from "../core/schema";

export class Document extends Model<DocumentEntity> {
    protected schema = {
        category:table.integer(),
        config:table.json(),
        altTitle:table.text(),
        title:table.text(),
        keywords:table.json(),
        file:table.json().nullable(),
        updatedAt:table.date()
    };
    
    
}