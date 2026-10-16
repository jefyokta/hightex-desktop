import { Router } from "./contract";

export class AuthRouter extends Router {
    private static pendingState: string | null = null;

  async handle(url: URL): Promise<Response> {
  if (url.pathname !== '/callback' ) {
    return this.notFound();
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
   if (
      !code ||
      !state ||
      !AuthRouter.pendingState ||
      state !== AuthRouter.pendingState
    ) {
      return this.abort(403)
    }
    return new Response()
    
  }
}
