/** Remove only the owning document's storage namespace, preserving authored dots. */
export function aliasKey(key: string, documentId: string): string {
  const prefix = `${documentId}.`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : key;
}
