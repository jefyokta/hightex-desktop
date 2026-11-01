const collator = new Intl.Collator("id", {
  numeric: true,
  sensitivity: "base",
});

export function sortAliases<T extends { key: string }>(
  aliases: readonly T[],
): T[] {
  return [...aliases].sort(
    (left, right) =>
      collator.compare(left.key, right.key) ||
      left.key.localeCompare(right.key, "id"),
  );
}
