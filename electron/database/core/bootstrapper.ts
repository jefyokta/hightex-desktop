import { Comment } from "../models/comment";
import { Snapshot } from "../models/snapshot";
import { Model } from "./model";

export class DatabaseBootstraper {
  private models: Model<any>[] = [new Comment(), new Snapshot()];
  tap() {
    for (const model of this.models) {
      model.boot();
    }
  }
}
