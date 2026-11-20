export function canonicalWorkspaceSnapshot(value: unknown): string {
  const canonical = (item: unknown): unknown => {
    if (item instanceof Date) return { date: item.toISOString() };
    if (item instanceof Uint8Array) return { bytes: Array.from(item) };
    if (Array.isArray(item)) return item.map(canonical);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, canonical(value)]),
      );
    return item;
  };
  return JSON.stringify(canonical(value));
}
