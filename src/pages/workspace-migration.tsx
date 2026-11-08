import { useEffect, useRef, useState } from "react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import {
  captureWorkspaceData,
  restoreWorkspaceData,
  workspaceSnapshotHash,
} from "@/workspaces/snapshot";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { t } from "@/utils/lang";

export function WorkspaceMigrationPage({
  target = false,
}: {
  target?: boolean;
}) {
  const [plan, setPlan] = useState<WorkspaceMigrationPlan>();
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preparation = useRef<Promise<WorkspaceMigrationPlan | void>>();
  useEffect(() => {
    let alive = true;
    preparation.current ??= (async () => {
      const db = HighTexDB.getInstance();
      await db.open();
      if (target) {
        const snapshot = await window.workspaces.migrationTarget();
        await restoreWorkspaceData(db, snapshot);
        const hash = await workspaceSnapshotHash(
          await captureWorkspaceData(db),
        );
        await window.workspaces.migrationVerified(hash);
      } else
        return window.workspaces.migrationPreview(
          await captureWorkspaceData(db),
        );
    })();
    void preparation.current
      .then((value) => {
        if (alive && value) setPlan(value);
      })
      .catch((cause) => {
        if (alive)
          setError(cause instanceof Error ? cause.message : String(cause));
        if (target)
          void window.workspaces.migrationVerified("failed").catch(() => {});
      });
    return () => {
      alive = false;
    };
  }, [target]);
  if (target) return null;
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-6 py-12">
      <h1 className="text-2xl font-semibold">
        {t("workspace_profiles.migration_title")}
      </h1>
      <p className="text-sm text-muted-foreground">
        {t("workspace_profiles.migration_description")}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {plan ? (
        <>
          <ul className="space-y-2">
            {plan.profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <span>{profile.name}</span>
                <span>
                  {
                    Object.values(plan.assignments).filter(
                      (id) => id === profile.id,
                    ).length
                  }{" "}
                  {t("workspace_profiles.documents")}
                </span>
              </li>
            ))}
          </ul>
          {plan.conflicts.map((conflict) => (
            <label
              key={conflict.documentId}
              className="block space-y-2 text-sm"
            >
              <span>
                {t("workspace_profiles.conflict")} —{" "}
                {conflict.title || conflict.documentId}
              </span>
              <NativeSelect
                value={resolutions[conflict.documentId] ?? ""}
                disabled={busy}
                onChange={(event) =>
                  setResolutions((previous) => ({
                    ...previous,
                    [conflict.documentId]: event.target.value,
                  }))
                }
              >
                <option value="">
                  {t("workspace_profiles.choose_destination")}
                </option>
                {plan.profiles
                  .filter(
                    (profile) =>
                      profile.id === "local" ||
                      (!conflict.reason.includes("binding") &&
                        profile.id === plan.assignments[conflict.documentId]),
                  )
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
              </NativeSelect>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            {t("workspace_profiles.shared_legacy")}
          </p>
          <Button
            disabled={
              busy ||
              plan.conflicts.some(
                (conflict) => !resolutions[conflict.documentId],
              )
            }
            onClick={() => {
              setBusy(true);
              setError("");
              void window.workspaces.migrate(resolutions).catch((cause) => {
                setError(
                  cause instanceof Error ? cause.message : String(cause),
                );
                setBusy(false);
              });
            }}
          >
            {t(
              busy
                ? "workspace_profiles.migrating"
                : "workspace_profiles.migrate",
            )}
          </Button>
        </>
      ) : (
        !error && <p role="status">{t("workspace_profiles.preparing")}</p>
      )}
    </main>
  );
}
