import { GuidanceClient } from "../clients/guidance-client";
import { submissionService } from "./submission-service";
import { ServerService } from "./server-service";

export const guidanceService = new GuidanceClient(submissionService, (endpoint, options) =>
  ServerService.documentSyncRequest(endpoint, {
    method: "GET", signal: AbortSignal.timeout(30000), ...options,
  }, "guidance revisions"),
);
