import { VariableCase } from "@/editor/extensions/variable";

export function applyCase(value: string, mode: VariableCase) {
  switch (mode) {
    case "upper":
      return value.toUpperCase();

    case "lower":
      return value.toLowerCase();

    case "capitalize":
      return value
        ? value[0].toUpperCase() + value.slice(1).toLowerCase()
        : value;

    case "title":
      return value.replace(
        /\w\S*/g,
        (w) => w[0].toUpperCase() + w.slice(1).toLowerCase(),
      );

    default:
      return value;
  }
}
