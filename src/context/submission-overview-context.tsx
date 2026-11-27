import { useIPC } from "@/hooks/use-ipc";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaces } from "@/hooks/use-workspaces";

interface SubmissionOverview {
  result?: SubmissionList;
  loading: boolean;
  error?: SubmissionErrorCode;
  refresh(): Promise<void>;
}
const Context = createContext<SubmissionOverview | undefined>(undefined);

/** The dashboard reads the audience from the server once for its navigation and inbox. */
export function SubmissionOverviewProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const online = useOnline();
  const { state } = useWorkspaces();
  const workspace = state?.profiles.find(profile => profile.id === state.activeId);
  const enabled = Boolean(user && online && workspace?.type === "cloud");
  const [received, setReceived] = useState<{ workspaceId: string; result: SubmissionResult<SubmissionList> }>();
  const [loading, setLoading] = useState(enabled);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => { setRevision(value => value + 1); }, []);

  useEffect(() => {
    setReceived(undefined);
    if (!enabled) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    const workspaceId = workspace!.id;
    void useIPC("hightex").hightex.submission.list().then(result => { if (active) setReceived({ workspaceId, result }); })
      .catch(() => { if (active) setReceived({ workspaceId, result: { ok: false, error: { code: "request_failed" } } }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled, user, workspace?.id, revision]);

  const response = received?.workspaceId === workspace?.id ? received?.result : undefined;
  const result = enabled && response?.ok && user && response.data.session.accountId === String(user.id) ? response.data : undefined;
  return <Context.Provider value={{ result, loading, refresh, error: enabled && response && !response.ok ? response.error.code : undefined }}>{children}</Context.Provider>;
}

export const useSubmissionOverview = () => useContext(Context);
