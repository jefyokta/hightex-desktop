import { useCallback, useEffect, useState } from "react";

export function useWorkspaces() {
  const [state, setState] = useState<WorkspaceState>();
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      if (window.workspaces) setState(await window.workspaces.state());
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
    const unsubscribe = window.workspaces?.onChange(changed);
    return () => {
      window.removeEventListener("workspaces:changed", changed);
      unsubscribe?.();
    };
  }, [refresh]);
  return { state, setState, error, setError, refresh };
}
