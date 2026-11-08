export {};

declare global {
  interface WorkspaceProfile {
    id: string;
    name: string;
    serverUrl: string | null;
    accountId: string | null;
  }
  interface WorkspaceState {
    activeId: string;
    profiles: WorkspaceProfile[];
    migrationComplete: boolean;
  }
  interface WorkspaceMigrationPlan {
    profiles: WorkspaceProfile[];
    assignments: Record<string, string>;
    conflicts: { documentId: string; title: string; reason: string }[];
  }
  interface WorkspaceDataSnapshot {
    tables: Record<string, Record<string, unknown>[]>;
    localStorage: Record<string, string>;
  }
  interface WorkspaceAPI {
    state(): Promise<WorkspaceState>;
    create(input: {
      name: string;
      serverUrl: string | null;
    }): Promise<WorkspaceState>;
    switch(id: string): Promise<void>;
    migrationPreview(
      snapshot: WorkspaceDataSnapshot,
    ): Promise<WorkspaceMigrationPlan>;
    migrate(resolutions: Record<string, string>): Promise<void>;
    migrationTarget(): Promise<WorkspaceDataSnapshot>;
    migrationVerified(hash: string): Promise<void>;
  }
}
