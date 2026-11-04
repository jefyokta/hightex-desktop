/** Normalize both API/installer payloads and older cached category records. */
export function parseCategoryDirectory(raw: unknown): Category[] {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !value ||
    typeof value !== "object" ||
    !("data" in value) ||
    !Array.isArray(value.data)
  )
    throw new Error("Invalid category directory");
  const ids = new Set<number>();
  return value.data.map((item: unknown) => {
    if (!item || typeof item !== "object") throw new Error("Invalid category");
    const category = item as Record<string, unknown>;
    const id =
      typeof category.id === "string" && /^\d+$/.test(category.id)
        ? Number(category.id)
        : category.id;
    const chapters =
      typeof category.chapters === "string"
        ? JSON.parse(category.chapters)
        : category.chapters;
    if (
      typeof id !== "number" ||
      !Number.isSafeInteger(id) ||
      id < 1 ||
      ids.has(id) ||
      typeof category.name !== "string" ||
      !category.name.trim() ||
      typeof category.variant !== "string" ||
      !["thesis", "proposal", "intern"].includes(category.variant) ||
      !Array.isArray(chapters) ||
      !chapters.length
    )
      throw new Error("Invalid category");
    const normalized = chapters.map((item: unknown) => {
      if (!item || typeof item !== "object")
        throw new Error("Invalid category chapter");
      const entry = item as Record<string, unknown>;
      const chapter =
        typeof entry.chapter === "number" &&
        Number.isSafeInteger(entry.chapter) &&
        entry.chapter > 0
          ? String(entry.chapter)
          : entry.chapter;
      if (
        typeof chapter !== "string" ||
        !chapter.trim() ||
        typeof entry.title !== "string"
      )
        throw new Error("Invalid category chapter");
      return { ...entry, chapter: chapter.trim(), title: entry.title };
    });
    if (
      new Set(normalized.map((entry) => entry.chapter)).size !==
      normalized.length
    )
      throw new Error("Duplicate category chapter");
    ids.add(id);
    return {
      ...category,
      id,
      name: category.name,
      variant: category.variant as CategoryVariant,
      chapters: normalized,
    };
  });
}
