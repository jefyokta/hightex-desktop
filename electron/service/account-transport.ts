// Authentication bodies and profile data must not enter HTTP error logs.
export const accountRequest = async (
  serverUrl: string,
  endpoint: string,
  options: RequestInit = {},
) => {
  const response = await fetch(
    `${serverUrl.replace(/\/?$/, "/")}${endpoint.replace(/^\/+/, "")}`,
    {
      ...options,
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...Object.fromEntries(new Headers(options.headers)),
      },
      signal: options.signal ?? AbortSignal.timeout(15000),
    },
  );
  let data: unknown = {};
  if (response.status !== 204) {
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
  }
  return { ok: response.ok, status: response.status, data };
};
