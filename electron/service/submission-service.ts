import { SubmissionClient } from "./submission-client";
import { ServerService } from "./server-service";
import { SessionService } from "./session-service";
import { ServerUrl } from "../url/server-url";

export const submissionService = new SubmissionClient({
  session: () => {
    const user = SessionService.getUser();
    const token = SessionService.getToken();
    return user && token
      ? {
          accountId: String(user.id),
          token,
          serverUrl: ServerUrl.instance.api.href,
        }
      : null;
  },
  request: (endpoint, options) =>
    ServerService.documentSyncRequest(
      endpoint,
      { method: "GET", signal: AbortSignal.timeout(30000), ...options },
      "submission",
    ),
});
