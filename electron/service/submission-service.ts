import { SubmissionClient } from "./submission-client";
import { ServerService } from "./server-service";
import { SessionService } from "./session-service";

export const submissionService = new SubmissionClient({
  session: () => {
    const user = SessionService.getUser();
    const token = SessionService.getToken();
    return user && token
      ? {
          accountId: String(user.id),
          token,
          serverUrl: ServerService.getServerUrl(),
        }
      : null;
  },
  request: (endpoint) =>
    ServerService.documentSyncRequest(
      endpoint,
      { method: "GET" },
      "submission",
    ),
});
