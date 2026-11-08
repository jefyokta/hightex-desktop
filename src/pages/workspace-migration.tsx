import { Disclosure } from "@/components/ui/disclosure";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Cloud,
  Laptop,
  LoaderCircle,
} from "lucide-react";
import { HighTexDB } from "@/editor/storage/hightex-db";
import {
  captureWorkspaceData,
  restoreWorkspaceData,
  workspaceSnapshotHash,
} from "@/workspaces/snapshot";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { t } from "@/utils/lang";
import hightexLogo from "@/assets/hightex.svg";
import { version as appVersion } from "../../package.json";
import "@/css/splash.css";

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
  const [complete, setComplete] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const preparation = useRef<Preparation>();
  const running = useRef(false);

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
        const hash = await workspaceSnapshotHash(
          await captureWorkspaceData(db),
        );
        await window.workspaces.migrationVerified(hash);
      } else {
        return window.workspaces.migrationPreview(
          await captureWorkspaceData(db),
        );
      }
    })();
    void preparation.current
      .then((value) => {
        if (alive && value) setPlan(value);
      })
      .catch((cause) => {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        if (target)
          void window.workspaces.migrationVerified("failed").catch(() => {});
      });
    return () => {
      alive = false;
    };
  }, [target, attempt]);

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
  const verified = Object.values(progress).filter(
    (status) => status === "complete",
  ).length;
  const unresolved = plan?.conflicts.some(
    (conflict) => !resolutions[conflict.documentId],
  );
  const startMigration = async () => {
    if (running.current || complete) return;
    running.current = true;
    setBusy(true);
    setError("");
    setProgress({});
    try {
      await window.workspaces.migrate(resolutions);
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const retryPreparation = () => {
    preparation.current = undefined;
    setError("");
    setAttempt((value) => value + 1);
  };

  return (
    <main
      className="splash-screen relative isolate flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground"
      data-workspace-migration
      data-state={
        complete
          ? "complete"
          : busy
            ? "migrating"
            : error
              ? "error"
              : plan
                ? "ready"
                : "preparing"
      }
      aria-busy={busy}
    >
      <div
        className="drag-bar absolute inset-x-0 top-0 z-10 h-7"
        aria-hidden="true"
      />
      <div
        className="splash-ambient"
        style={{ top: "25%", right: "-240px" }}
        aria-hidden="true"
      />
      <div className="relative mx-auto flex w-full max-w-5xl items-center gap-3 px-6 pt-10 sm:px-10">
        <img src={hightexLogo} alt="" className="size-10 rounded-xl" />
        <div>
          <p className="text-base font-semibold tracking-tight">
            HighTex<span className="splash-brand-text">.</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("workspace_profiles.migration_update", {
              version: `v${appVersion}`,
            })}
          </p>
        </div>
      </div>
      <section className="relative mx-auto grid w-full max-w-5xl flex-1 content-center gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-16">
        <header className="max-w-sm self-start">
          <span className="splash-brand-rule mb-6 block" aria-hidden="true" />
          <h1 className="text-[clamp(2rem,3.5vw,3.25rem)] font-semibold leading-[1.1] tracking-[-0.045em]">
            {t(
              complete
                ? "workspace_profiles.migration_complete"
                : "workspace_profiles.migration_title",
            )}
          </h1>
          <p className="mt-5 text-sm leading-7 text-muted-foreground">
            {t(
              complete
                ? "workspace_profiles.migration_complete_description"
                : "workspace_profiles.migration_description",
            )}
          </p>
          {!complete && (
            <p className="mt-6 text-xs leading-5 text-muted-foreground">
              {t("workspace_profiles.migration_backup_hint")}
            </p>
          )}
        </header>

        <div className="min-w-0">
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 px-4 py-3 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium">
                  {t("workspace_profiles.migration_failed")}
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {error}
                </p>
              </div>
            </div>
          )}

          {plan ? (
            <>
              <section aria-labelledby="migration-destinations">
                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2
                    id="migration-destinations"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    {t("workspace_profiles.destinations_title")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {summary.documents} {t("workspace_profiles.documents")}
                  </p>
                </div>
                <ul className="divide-y divide-border/70 border-y border-border/70">
                  {plan.profiles.map((profile) => {
                    const counts = plan.summary?.[profile.id];
                    const status = complete ? "complete" : progress[profile.id];
                    return (
                      <li
                        key={profile.id}
                        className="flex items-center gap-3 py-3.5"
                        data-migration-profile={profile.id}
                        data-status={status ?? "pending"}
                      >
                        <span className="splash-brand-text flex size-9 shrink-0 items-center justify-center">
                          {profile.type === "cloud" ? (
                            <Cloud
                              aria-hidden="true"
                              className="size-5 shrink-0"
                            />
                          ) : (
                            <Laptop
                              aria-hidden="true"
                              className="size-5 shrink-0"
                            />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{profile.name}</p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {profile.accountId
                              ? t("workspace_profiles.account_id", {
                                  id: profile.accountId,
                                })
                              : t("workspace_profiles.migration_on_device")}
                          </p>
                        </div>
                        <div className="shrink-0 space-y-1.5 text-right">
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {counts?.documents ?? 0}{" "}
                            {t("workspace_profiles.documents")}
                          </p>
                          {status && (
                            <p
                              className={`flex items-center justify-end gap-1 text-[11px] ${status === "failed" ? "text-destructive" : status === "complete" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
                            >
                              {status === "copying" ||
                              status === "verifying" ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="size-3.5 animate-spin"
                                />
                              ) : status === "complete" ? (
                                <Check
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              ) : (
                                <AlertCircle
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              )}
                              {t(`workspace_profiles.progress_${status}`)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {!complete && plan.conflicts.length > 0 && (
                <section className="mt-7" aria-labelledby="migration-review">
                  <h2 id="migration-review" className="text-sm font-medium">
                    {t("workspace_profiles.review_title")}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("workspace_profiles.review_description")}
                  </p>
                  <div className="mt-2 divide-y">
                    {plan.conflicts.map((conflict) => (
                      <label
                        key={conflict.documentId}
                        className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
                      >
                        <span className="break-words">
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
                                  profile.id ===
                                    plan.assignments[conflict.documentId]),
                            )
                            .map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))}
                        </NativeSelect>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {!complete && (
                <Disclosure
                  className="mt-4 text-xs text-muted-foreground"
                  triggerClassName="w-fit cursor-pointer py-1 hover:text-foreground"
                  label={t("workspace_profiles.migration_details")}
                >
                  <p className="mt-2 leading-relaxed">
                    {summary.branches} {t("workspace_profiles.branches")}
                    {" · "}
                    {summary.assets} {t("workspace_profiles.assets")}
                    {" · "}
                    {summary.forms} {t("workspace_profiles.forms")}
                  </p>
                  <p className="mt-2 leading-relaxed">
                    {t("workspace_profiles.shared_legacy")}
                  </p>
                </Disclosure>
              )}

              <footer className="mt-7">
                {complete ? (
                  <p
                    role="status"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {t("workspace_profiles.migration_restart_hint")}
                  </p>
                ) : (
                  <>
                    <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <p
                        className="text-xs leading-relaxed text-muted-foreground"
                        role={busy ? "status" : undefined}
                      >
                        {busy
                          ? t("workspace_profiles.migration_verified_count", {
                              count: verified,
                              total: plan.profiles.length,
                            })
                          : ""}
                      </p>
                      <Button
                        className="h-11 gap-6 rounded-xl px-5"
                        disabled={busy || unresolved}
                        onClick={() => void startMigration()}
                        data-migration-start
                      >
                        {busy ? (
                          <>
                            <LoaderCircle
                              aria-hidden="true"
                              className="size-4 animate-spin"
                            />
                            {t("workspace_profiles.migrating")}
                          </>
                        ) : (
                          <>
                            {t(
                              error
                                ? "workspace_profiles.retry"
                                : "workspace_profiles.migrate",
                            )}
                            <ArrowRight aria-hidden="true" className="size-4" />
                          </>
                        )}
                      </Button>
                    </div>
                    {busy && (
                      <progress
                        aria-label={t("workspace_profiles.migrating")}
                        value={verified}
                        max={plan.profiles.length || 1}
                        className="mt-4 block h-1 w-full overflow-hidden rounded-full accent-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary"
                      />
                    )}
                  </>
                )}
              </footer>
            </>
          ) : !error ? (
            <p
              role="status"
              className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              {t("workspace_profiles.preparing")}
            </p>
          ) : (
            <Button
              className="mb-7"
              variant="outline"
              onClick={retryPreparation}
            >
              {t("workspace_profiles.retry")}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
