import { Comment } from "../models/comment";
import { Snapshot } from "../models/snapshot";
import { Model } from "./model";

export class DatabaseBootstraper {

  static tapped = false;
  private models: Model<any>[] = [new Comment(), new Snapshot()];
  tap() {
    if(DatabaseBootstraper.tapped) return;
    for (const model of this.models) {
      model.boot();

    }
    DatabaseBootstraper.tapped = true
  }
}
