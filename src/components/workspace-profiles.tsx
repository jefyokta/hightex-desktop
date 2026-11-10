import { useState } from "react";
import {
  ArrowRightLeft,
  Check,
  Cloud,
  Laptop,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAuthModal } from "@/context/auth-modal-context";
import { useOnline } from "@/hooks/use-online";
import {
  LANGUAGE_OPTIONS,
  t,
  useAppLanguage,
  type SupportedLanguage,
} from "@/utils/lang";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect } from "./ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function WorkspaceProfiles() {
  const { state, setState, error, setError } = useWorkspaces();
  const language = useAppLanguage();
  const online = useOnline();
  const { openLogin, closeLogin } = useAuthModal();
  const [name, setName] = useState("");
  const [type, setType] = useState<"local" | "cloud">("local");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameId, setRenameId] = useState<string>();
  const [renameName, setRenameName] = useState("");
  const [deleteId, setDeleteId] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!state?.migrationComplete) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const workspaceError: Record<string, string> = {
        "Workspace switch canceled; an editor remains open.": t(
          "workspace_profiles.switch_canceled",
        ),
        "Close preview or export windows before switching workspaces.": t(
          "workspace_profiles.switch_blocked",
        ),
        "Close other windows before deleting a workspace": t(
          "workspace_profiles.delete_blocked",
        ),
        "Workspace switch canceled because a file or link was opened.": t(
          "workspace_profiles.switch_interrupted",
        ),
      };
      setError(
        message === "Workspace name already exists"
          ? t("workspace_profiles.name_taken")
          : (workspaceError[message] ?? message),
      );
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = () =>
    run(async () => {
      const previousIds = new Set(state.profiles.map((profile) => profile.id));
      const next = await window.workspaces.create({ name, type });
      const created = next.profiles.find((profile) => !previousIds.has(profile.id));
      setState(next);
      window.dispatchEvent(new Event("workspaces:changed"));
      setName("");
      setType("local");
      setCreateOpen(false);
      if (type === "cloud" && created)
        await window.workspaces.switch(created.id);
    });

  const renameWorkspace = () =>
    run(async () => {
      if (!renameId) return;
      setState(await window.workspaces.rename(renameId, renameName));
      window.dispatchEvent(new Event("workspaces:changed"));
      setRenameId(undefined);
    });

  const deleteWorkspace = () =>
    run(async () => {
      if (!deleteId) return;
      setState(await window.workspaces.delete(deleteId));
      window.dispatchEvent(new Event("workspaces:changed"));
      setDeleteId(undefined);
    });

  const connectWorkspace = (profile: WorkspaceProfile) =>
    run(async () => {
      if (profile.id !== state.activeId) {
        if (profile.type === "local" && !profile.pendingCloudBinding) {
          const next = await window.workspaces.beginCloudBinding(profile.id);
          setState(next);
          window.dispatchEvent(new Event("workspaces:changed"));
        }
        await window.workspaces.switch(profile.id);
        return;
      }
      if (profile.type === "local" && !profile.pendingCloudBinding) {
        setState(await window.workspaces.beginCloudBinding(profile.id));
        window.dispatchEvent(new Event("workspaces:changed"));
      }
      openLogin();
    });

  const cancelConnection = (profile: WorkspaceProfile) =>
    run(async () => {
      if (profile.id === state.activeId) await window.session.browser.cancel();
      setState(await window.workspaces.cancelCloudBinding(profile.id));
      window.dispatchEvent(new Event("workspaces:changed"));
      if (profile.id === state.activeId) closeLogin();
    });

  return (
    <>
      <Card data-workspace-profiles>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>{t("workspace_profiles.profiles_title")}</CardTitle>
            <CardDescription>
              {t("workspace_profiles.profiles_description")}
            </CardDescription>
          </div>
          <Button
            data-tour="workspace-create"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            {t("workspace_profiles.create")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.profiles.map((profile) => {
            const active = profile.id === state.activeId;
            const Icon =
              profile.type === "cloud" || profile.pendingCloudBinding
                ? Cloud
                : Laptop;
            return (
              <div
                key={profile.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${active ? "border-primary/40 bg-primary/4" : "bg-card"}`}
                data-workspace-profile={profile.id}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{profile.name}</p>
                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        <Check className="size-3" />
                        {t("workspace_profiles.active_badge")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {profile.pendingCloudBinding
                      ? t("workspace_profiles.cloud_pending")
                      : profile.type === "cloud"
                        ? profile.accountId
                          ? t("workspace_profiles.cloud_bound")
                          : t("workspace_profiles.cloud_unbound")
                        : t("workspace_profiles.local")}
                  </p>
                  {active && profile.id !== "local" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("workspace_profiles.delete_active_hint")}
                    </p>
                  )}
                  {profile.legacyCloudBinding && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("workspace_profiles.legacy_cloud_unavailable")}
                    </p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setRenameId(profile.id);
                      setRenameName(profile.name);
                    }}
                  >
                    <Pencil />
                    <span className="sr-only">{t("workspace_profiles.rename")}</span>
                  </Button>
                  {!active && profile.id !== "local" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => setDeleteId(profile.id)}
                    >
                      <Trash2 />
                      <span className="sr-only">
                        {t("workspace_profiles.delete")}
                      </span>
                    </Button>
                  )}
                  {!active && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(() => window.workspaces.switch(profile.id))
                      }
                    >
                      <ArrowRightLeft />
                      {t("workspace_profiles.switch")}
                    </Button>
                  )}
                  {active &&
                    profile.type === "local" &&
                    !profile.legacyCloudBinding &&
                    (profile.pendingCloudBinding ? (
                      <>
                        <Button
                          size="sm"
                          disabled={busy || (active && !online)}
                          onClick={() => void connectWorkspace(profile)}
                        >
                          <Cloud />
                          {t(
                            "workspace_profiles.continue_login",
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void cancelConnection(profile)}
                        >
                          {t("workspace_profiles.cancel_cloud")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy || (active && !online)}
                        onClick={() => void connectWorkspace(profile)}
                      >
                        <Cloud />
                        {t("workspace_profiles.connect_cloud")}
                      </Button>
                    ))}
                  {active &&
                    profile.type === "cloud" &&
                    !profile.accountId && (
                      <Button
                        size="sm"
                        disabled={busy || !online}
                        onClick={() => void connectWorkspace(profile)}
                      >
                        <Cloud />
                        {t("workspace_profiles.continue_login")}
                      </Button>
                    )}
                  {!active &&
                    profile.type === "local" &&
                    profile.pendingCloudBinding && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void cancelConnection(profile)}
                      >
                        {t("workspace_profiles.cancel_cloud")}
                      </Button>
                    )}
                </div>
              </div>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="pt-2 text-xs leading-relaxed text-muted-foreground">
            {t("workspace_profiles.switch_hint")}
          </p>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="workspace sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace_profiles.create_title")}</DialogTitle>
            <DialogDescription>
              {t("workspace_profiles.create_description")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createWorkspace();
            }}
          >
            <label className="block space-y-1.5 text-sm">
              <span>{t("workspace_profiles.name")}</span>
              <Input
                value={name}
                maxLength={100}
                required
                disabled={busy}
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span>{t("workspace_profiles.type")}</span>
              <NativeSelect
                value={type}
                disabled={busy}
                onChange={(event) =>
                  setType(event.target.value as "local" | "cloud")
                }
              >
                <option value="local">{t("workspace_profiles.local_type")}</option>
                <option value="cloud">{t("workspace_profiles.cloud_type")}</option>
              </NativeSelect>
            </label>
            {state.profiles.length === 1 && (
              <label className="block space-y-1.5 text-sm">
                <span>{t("workspace_profiles.language")}</span>
                <NativeSelect
                  value={language}
                  disabled={busy}
                  onChange={(event) =>
                    void window.config.set({
                      language: event.target.value as SupportedLanguage,
                    })
                  }
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {type === "cloud"
                ? t("workspace_profiles.cloud_hint")
                : t("workspace_profiles.local_hint")}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreateOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy
                  ? t("common.loading")
                  : t("workspace_profiles.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameId)}
        onOpenChange={(open) => !open && setRenameId(undefined)}
      >
        <DialogContent className="workspace sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace_profiles.rename_title")}</DialogTitle>
            <DialogDescription>
              {t("workspace_profiles.rename_description")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void renameWorkspace();
            }}
          >
            <Input
              value={renameName}
              maxLength={100}
              required
              disabled={busy}
              autoFocus
              onChange={(event) => setRenameName(event.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRenameId(undefined)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={busy || !renameName.trim()}
              >
                {t("workspace_profiles.rename_action")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(undefined)}
      >
        <DialogContent className="workspace sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace_profiles.delete_title")}</DialogTitle>
            <DialogDescription>
              {t("workspace_profiles.delete_description", {
                name: state.profiles.find((profile) => profile.id === deleteId)
                  ?.name,
              })}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDeleteId(undefined)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !deleteId}
              onClick={() => void deleteWorkspace()}
            >
              <Trash2 />
              {busy
                ? t("common.loading")
                : t("workspace_profiles.delete_action")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
