import { useIPC } from "@/hooks/use-ipc";
import { useCallback, useEffect, useState } from "react";

export function useWorkspaces() {
  const [state, setState] = useState<WorkspaceState>();
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      if (useIPC("workspaces").workspaces) setState(await useIPC("workspaces").workspaces.state());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener("workspaces:changed", changed);
    const unsubscribe = useIPC("workspaces").workspaces?.onChange(changed);
    return () => {
      window.removeEventListener("workspaces:changed", changed);
      unsubscribe?.();
    };
  }, [refresh]);
  return { state, setState, error, setError, refresh };
}
