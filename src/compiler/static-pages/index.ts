import { Intern } from "./intern";
import { Proposal } from "./proposal";
import { Thesis } from "./thesis";

export class StaticPages {
  static create(variant: CategoryVariant) {
    switch (variant) {
      case "proposal":
        return Proposal;
      case "intern":
        return Intern;
      case "thesis":
      default:
        return Thesis;
    }
  }
}
