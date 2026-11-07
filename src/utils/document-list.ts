export type DocumentSort = "updated" | "title" | "oldest";

export function filterDocuments(
  documents: HighTexDocument[],
  query: string,
  category: string,
  sort: DocumentSort,
) {
  const search = query.trim().toLocaleLowerCase();
  const time = (doc: HighTexDocument) => {
    const value = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;
    return Number.isFinite(value) ? value : 0;
  };
  return documents
    .filter((doc) => !doc.parentId)
    .filter(
      (doc) =>
        (category === "all" || String(doc.category) === category) &&
        (!search ||
          [
            doc.title,
            doc.altTitle,
            ...(doc.keywords?.indonesian ?? []),
            ...(doc.keywords?.english ?? []),
          ].some((value) => value?.toLocaleLowerCase().includes(search)) ||
          documents.some(
            (branch) =>
              branch.parentId === doc.id &&
              branch.branchName?.toLocaleLowerCase().includes(search),
          )),
    )
    .sort((a, b) => {
      const order =
        sort === "title"
          ? a.title.localeCompare(b.title, "id", {
              numeric: true,
              sensitivity: "base",
            })
          : sort === "oldest"
            ? time(a) - time(b)
            : time(b) - time(a);
      return (
        order ||
        a.title.localeCompare(b.title, "id", { numeric: true }) ||
        a.id.localeCompare(b.id)
      );
    });
}
