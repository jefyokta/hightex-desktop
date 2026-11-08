/** A document window can only navigate between sections of its own document. */
export function isEditorDocumentPath(pathname: string, documentId: string) {
  const match = /^\/document\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?\/?$/.exec(
    pathname,
  );
  if (!match) return false;
  try {
    return (
      decodeURIComponent(match[1]) === documentId &&
      decodeURIComponent(match[2] ?? "") !== "print"
    );
  } catch {
    return false;
  }
}
