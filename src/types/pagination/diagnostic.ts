import type {
  EngineDiagnostic,
  EngineIssueCode,
  EngineIssueLevel,
} from "../document-engine";

export interface PaginationDiagnostic extends Partial<EngineDiagnostic> {
  message: string;
  code: EngineIssueCode;
  level: EngineIssueLevel;
}
