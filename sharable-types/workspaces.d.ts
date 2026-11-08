export {};

declare global {
  interface WorkspaceProfile {
    id: string;
    name: string;
    type: "local" | "cloud";
    serverUrl: string | null;
    accountId: string | null;
    legacyCloudBinding?: { serverUrl: string; accountId: string | null };
    loginOnFirstUse?: boolean;
    pendingCloudBinding?: boolean;
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
    summary?: Record<
      string,
      { documents: number; branches: number; assets: number; forms: number }
    >;
  }
  type WorkspaceMigrationProgress = {
    profileId: string;
    status: "copying" | "verifying" | "complete" | "failed";
  };
  interface WorkspaceDataSnapshot {
    tables: Record<string, Record<string, unknown>[]>;
    localStorage: Record<string, string>;
  }
  interface WorkspaceAPI {
    state(): Promise<WorkspaceState>;
    onChange(callback: () => void): () => void;
    create(input: {
      name: string;
      type: "local" | "cloud";
    }): Promise<WorkspaceState>;
    beginCloudBinding(id: string): Promise<WorkspaceState>;
    cancelCloudBinding(id: string): Promise<WorkspaceState>;
    rename(id: string, name: string): Promise<WorkspaceState>;
    switch(id: string): Promise<void>;
    migrationPreview(
      snapshot: WorkspaceDataSnapshot,
    ): Promise<WorkspaceMigrationPlan>;
    migrate(resolutions: Record<string, string>): Promise<void>;
    migrationTarget(): Promise<WorkspaceDataSnapshot>;
    migrationVerified(hash: string): Promise<void>;
    onMigrationProgress(
      callback: (progress: WorkspaceMigrationProgress) => void,
    ): () => void;
  }
}
