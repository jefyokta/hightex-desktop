import Store from "electron-store";
import { AdvisorClient, type AdvisorStoreData } from "./advisor-client";
import { submissionService } from "./submission-service";
import { ServerService } from "./server-service";

const store = new Store<AdvisorStoreData>({
  name: "advisor-review",
  defaults: { documents: {}, pending: {}, completed: [] },
});
export const advisorService = new AdvisorClient(submissionService, {
  request: (endpoint, options) =>
    ServerService.documentSyncRequest(
      endpoint,
      { method: "GET", signal: AbortSignal.timeout(30000), ...options },
      "advisor review",
    ),
  read: () => store.store,
  write: (data) => {
    store.store = data;
  },
});
