import { useState } from "react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { t } from "@/utils/lang";
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

export function WorkspaceProfiles({ compact = false }: { compact?: boolean }) {
  const { state, setState, error, setError } = useWorkspaces();
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [busy, setBusy] = useState(false);
  if (!state?.migrationComplete) return null;
  const active = state.profiles.find(
    (profile) => profile.id === state.activeId,
  )!;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  const picker = (
    <div className="space-y-2" data-workspace-profiles>
      <label
        className="text-xs text-muted-foreground"
        htmlFor={compact ? "workspace-compact" : "workspace-profile"}
      >
        {t("workspace_profiles.active")}
      </label>
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          id={compact ? "workspace-compact" : "workspace-profile"}
          className="min-w-0 flex-1"
          value={selected || state.activeId}
          disabled={busy}
          onChange={(event) => setSelected(event.target.value)}
        >
          {state.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !selected || selected === state.activeId}
          onClick={() => void run(() => window.workspaces.switch(selected))}
        >
          {t("workspace_profiles.switch")}
        </Button>
      </div>
      <p className="break-all text-xs text-muted-foreground">
        {active.serverUrl
          ? `${new URL(active.serverUrl).host}${active.accountId ? ` · ${active.accountId}` : ""}`
          : t("workspace_profiles.local")}
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
  if (compact) return picker;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workspace_profiles.title")}</CardTitle>
        <CardDescription>{t("workspace_profiles.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {picker}
        <p className="text-xs text-muted-foreground">
          {t("workspace_profiles.switch_hint")}
        </p>
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const next = await window.workspaces.create({
                name,
                serverUrl: serverUrl.trim() || null,
              });
              setState(next);
              window.dispatchEvent(new Event("workspaces:changed"));
              setSelected(next.profiles[next.profiles.length - 1].id);
              setName("");
              setServerUrl("");
            });
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{t("workspace_profiles.name")}</span>
            <Input
              value={name}
              maxLength={100}
              required
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t("workspace_profiles.server")}</span>
            <Input
              type="url"
              value={serverUrl}
              placeholder="https://hightex.example.com"
              disabled={busy}
              onChange={(event) => setServerUrl(event.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {t("workspace_profiles.server_hint")}
          </p>
          <Button type="submit" disabled={busy || !name.trim()}>
            {t("workspace_profiles.create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
