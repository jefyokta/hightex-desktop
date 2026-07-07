export class ApplicationError extends Error {
  readonly name: string;

  constructor(message?: string) {
    super(message);

    this.name = this.constructor.name;
  }
  static normilize(err: unknown) {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err == "string") {
      return err;
    }
    if (typeof err == "object") {
      return JSON.stringify(err);
    }
    return String(err);
  }

  static getMainErrorName(error:unknown){
    const message = this.normilize(error)
    const errorName = message.split(":")[2]
    if(errorName){
      return errorName.trim()
    }
    return false
  }
}
