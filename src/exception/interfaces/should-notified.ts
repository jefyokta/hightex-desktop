import { uniqId } from "@/utils/uniq-id";
import { RegisterMainError } from "@/decorators/error-name";
import { ThrowByMain } from "./throw-by-main";

export type NotificationErrorLevel = "warning" | "error";

@RegisterMainError("ShouldNotified")
export class ShouldNotified<
  TLevel extends NotificationErrorLevel = "warning",
> extends ThrowByMain {
  readonly level: TLevel;
  public message!: string;
  public description!: string;
  private _id!: string;
  readonly action?: React.ReactNode;

  public get id() {
    return this._id;
  }

  constructor(desc: string, action?: React.ReactNode, id?: string);
  constructor(options: {
    message: string;
    description: string;
    action?: React.ReactNode;
    id?: string;
  });
  constructor(optOrDesc: any, action?: any, id?: any) {
    let msg = "";
    let desc = "";
    let act = action;
    let finalId = id;

    if (typeof optOrDesc === "object" && optOrDesc !== null) {
      msg = optOrDesc.message;
      desc = optOrDesc.description;
      act = optOrDesc.action;
      finalId = optOrDesc.id;
    } else {
      desc = optOrDesc;
      msg = "Something Went Wrong";
    }

    super(msg);

    this.message = msg;
    this.description = desc;
    this.action = act;
    this._id = finalId || uniqId();

    this.level = "warning" as TLevel;
  }

  setId(id: string) {
    this._id = id;
  }

  onMainThrowing(msg: string): this {
    this.description = msg;
    if (!this.message) {
      this.message = "Something went wrong";
    }
    return this;
  }
}
