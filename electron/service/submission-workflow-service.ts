import Store from "electron-store";
import { SubmissionWorkflow } from "./submission-workflow";
import { documentService, cloudAcademicService } from "./document-service";
import { submissionService } from "./submission-service";

const store = new Store<{ attempts: Record<string, SubmissionAttempt> }>({
  name: "submission-attempts",
});

export const submissionWorkflow = new SubmissionWorkflow(
  documentService,
  submissionService,
  {
    read: () => store.get("attempts") ?? {},
    write: (attempts) => store.set("attempts", attempts),
  },
  (input) => cloudAcademicService.verify(input, input.serverDocumentId),
);
