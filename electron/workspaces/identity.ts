const PROFILE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function workspaceHost(id: string): string {
  if (!PROFILE_ID.test(id)) throw Error("Invalid workspace ID");
  return `profile.${id}`;
}

export function workspaceIdFromUrl(value: string | URL): string | null {
  const url = new URL(value);
  if (url.protocol !== "hightex:" || url.username || url.password || url.port)
    return null;
  const match = /^profile\.([a-z0-9][a-z0-9-]{0,62})$/.exec(url.hostname);
  return match?.[1] ?? null;
}

export function normalizeWorkspaceServer(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/", "/api", "/api/"].includes(url.pathname)
  )
    throw Error("Invalid workspace server URL");
  return `${url.origin}/api/`;
}
