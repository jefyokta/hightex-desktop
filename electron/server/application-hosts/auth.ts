import { Router } from "./contract";
import { desktopAuth } from "../../service/auth-service";
export class AuthRouter extends Router {
  async handle(url: URL): Promise<Response> {
    if (url.pathname !== "/callback") return this.notFound();
    const result = await desktopAuth.callback(url.toString());
    return new Response(
      result.ok
        ? "Login completed. Return to HighTex."
        : "Invalid or expired login callback.",
      { status: result.ok ? 200 : 403 },
    );
  }
}
