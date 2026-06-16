import { Comments } from "../models/comments";
import { Model } from "./model";

export class DatabaseBootstraper {
  private models: Model<any>[] = [new Comments()];
  tap() {
    for (const model of this.models) {
      model.boot();
    }
  }
}
