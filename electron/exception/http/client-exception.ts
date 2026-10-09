import { HttpException } from "./http-exception";
import { appEvent } from "@main/event";

export class ClientException extends HttpException {
  constructor(res: Response, message: any) {
    super(res, message);
    this.message = message;
    if (res.status === 401 || res.status == 403) {
      appEvent.emit("unauthorized", {
        reason: this.reason,
      });
    }
  }

  private get reason() {
    try {
      const obj = JSON.parse(this.message);
      if ("error" in obj) {
        return obj.error;
      }
      throw new Error("nih literal text");
    } catch (error) {
      return this.message;
    }
  }
}
