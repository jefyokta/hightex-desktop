export const name = (name?: string) =>
  !name ? "" : name.endsWith(".") ? name : `${name}.`;
