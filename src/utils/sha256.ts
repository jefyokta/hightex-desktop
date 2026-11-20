/** Shared browser-side SHA-256 encoding for archives, layout and export identities. */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export const sha256Text = (text: string): Promise<string> =>
  sha256Bytes(new TextEncoder().encode(text));
