import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Cloud, FileStack, Image, LoaderCircle } from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import {
  captureWorkspaceData,
  restoreWorkspaceData,
  workspaceSnapshotHash,
} from "@/workspaces/snapshot";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/utils/lang";

type Preparation = Promise<WorkspaceMigrationPlan | void>;

export function WorkspaceMigrationPage({
  target = false,
}: {
  target?: boolean;
}) {
  const [plan, setPlan] = useState<WorkspaceMigrationPlan>();
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<
    Record<string, WorkspaceMigrationProgress["status"]>
  >({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preparation = useRef<Preparation>();

  useEffect(() => {
    if (target) return;
    return window.workspaces.onMigrationProgress?.((update) => {
      setProgress((previous) => ({
        ...previous,
        [update.profileId]: update.status,
      }));
    });
  }, [target]);

  useEffect(() => {
    let alive = true;
    preparation.current ??= (async () => {
      const db = HighTexDB.getInstance();
      await db.open();
      if (target) {
        const snapshot = await window.workspaces.migrationTarget();
        await restoreWorkspaceData(db, snapshot);
        const hash = await workspaceSnapshotHash(await captureWorkspaceData(db));
        await window.workspaces.migrationVerified(hash);
      } else {
        return window.workspaces.migrationPreview(await captureWorkspaceData(db));
      }
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

  const summary = Object.values(plan?.summary ?? {}).reduce(
    (total, item) => ({
      documents: total.documents + item.documents,
      branches: total.branches + item.branches,
      assets: total.assets + item.assets,
      forms: total.forms + item.forms,
    }),
    { documents: 0, branches: 0, assets: 0, forms: 0 },
  );
  const startMigration = () => {
    setBusy(true);
    setError("");
    setProgress({});
    void window.workspaces.migrate(resolutions).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    });
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          HighTex · {t("workspace_profiles.migration_title")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("workspace_profiles.migration_title")}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("workspace_profiles.migration_description")}
        </p>
      </header>

      <ol className="grid grid-cols-3 gap-2 text-xs sm:gap-4">
        {(["step_summary", "step_destinations", "step_transfer"] as const).map(
          (key, index) => (
            <li
              key={key}
              aria-current={busy ? (index === 2 ? "step" : undefined) : index === 1 ? "step" : undefined}
              className={`flex items-center gap-2 border-t-2 pt-3 ${
                busy
                  ? index === 2
                    ? "border-primary text-foreground"
                    : "border-muted text-muted-foreground"
                  : index <= 1
                    ? "border-primary text-foreground"
                    : "border-muted text-muted-foreground"
              }`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-medium">
                {busy && index < 2 ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span>{t(`workspace_profiles.${key}`)}</span>
            </li>
          ),
        )}
      </ol>

      {error && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">{t("workspace_profiles.migration_failed")}</p>
            <p className="mt-1 text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {plan ? (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              { label: "documents", value: summary.documents, icon: FileStack },
              { label: "branches", value: summary.branches, icon: FileStack },
              { label: "assets", value: summary.assets, icon: Image },
              { label: "forms", value: summary.forms, icon: FileStack },
            ] as const).map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </span>
                  <span>
                    <strong className="block text-xl font-semibold">{value}</strong>
                    <span className="text-xs text-muted-foreground">
                      {t(`workspace_profiles.${label}`)}
                    </span>
                  </span>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>{t("workspace_profiles.destinations_title")}</CardTitle>
              <CardDescription>
                {t("workspace_profiles.destinations_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {plan.profiles.map((profile) => {
                const counts = plan.summary?.[profile.id];
                const status = progress[profile.id];
                return (
                  <article
                    key={profile.id}
                    className="rounded-xl border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        {profile.type === "cloud" ? (
                          <Cloud className="size-4 text-muted-foreground" />
                        ) : (
                          <FileStack className="size-4 text-muted-foreground" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="truncate font-medium">{profile.name}</h2>
                          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t(`workspace_profiles.${profile.type}_type`)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("workspace_profiles.destination_counts", {
                            documents: counts?.documents ?? 0,
                            branches: counts?.branches ?? 0,
                            assets: counts?.assets ?? 0,
                            forms: counts?.forms ?? 0,
                          })}
                        </p>
                        {status && (
                          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            {status === "copying" || status === "verifying" ? (
                              <LoaderCircle className="size-3.5 animate-spin" />
                            ) : status === "complete" ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="size-3.5 text-destructive" />
                            )}
                            {t(`workspace_profiles.progress_${status}`)}
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </CardContent>
          </Card>

          {plan.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("workspace_profiles.review_title")}</CardTitle>
                <CardDescription>
                  {t("workspace_profiles.review_description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {plan.conflicts.map((conflict) => (
                  <label
                    key={conflict.documentId}
                    className="grid gap-2 border-t pt-4 text-sm sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center"
                  >
                    <span>
                      <span className="block font-medium">
                        {conflict.title || conflict.documentId}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("workspace_profiles.conflict")}
                      </span>
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
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t("workspace_profiles.shared_legacy")}
            </p>
            <Button
              className="shrink-0"
              disabled={
                busy ||
                plan.conflicts.some(
                  (conflict) => !resolutions[conflict.documentId],
                )
              }
              onClick={startMigration}
            >
              {busy
                ? t("workspace_profiles.migrating")
                : error
                  ? t("workspace_profiles.retry")
                  : t("workspace_profiles.migrate")}
            </Button>
          </div>
        </>
      ) : (
        !error && <p role="status">{t("workspace_profiles.preparing")}</p>
      )}
    </main>
  );
}
