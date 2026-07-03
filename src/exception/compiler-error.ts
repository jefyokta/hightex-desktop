import { ShouldNotified } from "./interfaces/should-notified";

export class CompilerError extends ShouldNotified {
  constructor(desc: string) {
    super({ message: "Compilation Error", description: desc });
  }
}
