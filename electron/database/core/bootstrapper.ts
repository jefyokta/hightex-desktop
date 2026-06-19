import { Comment } from "../models/comments";
import { Model } from "./model";

export class DatabaseBootstraper {
  private models: Model<any>[] = [new Comment()];
  tap() {
    for (const model of this.models) {
      model.boot();
    }
  }
}
