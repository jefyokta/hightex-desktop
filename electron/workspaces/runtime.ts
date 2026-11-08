// Set before importing services: many stores and SQLite open at module load.
export class WorkspaceRuntime {
  static root: string | undefined;
  static serverUrl: string | undefined;
  static profile: WorkspaceProfile | undefined;
  static migrating = false;
  static switching = false;
  static switchInterrupted = false;
  static protocolRegistered = false;
}
