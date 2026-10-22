import { Engine } from "../engine";

export interface Resolver {
  resolve(engine: Engine): Awaited<any>;
}
