import { ThrowByMain } from "./interfaces/throw-by-main";

export class ShouldSilent extends ThrowByMain {
  onMainThrowing(_msg: string): this {
    return this;
  }
}
