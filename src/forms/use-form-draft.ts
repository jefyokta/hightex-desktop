import { useCallback, useEffect, useState, type SetStateAction } from "react";
import {
  FORM_DRAFT_KEY,
  readLegacyFormDrafts,
  readWorkspaceFormDraft,
  type WorkspaceFormDraft,
} from "./draft";

function load() {
  try {
    return {
      draft: readWorkspaceFormDraft(localStorage),
      legacy: readLegacyFormDrafts(localStorage),
      failed: false,
    };
  } catch {
    return { draft: undefined, legacy: [], failed: true };
  }
}

export function useFormDraft() {
  const [state, setState] = useState(load);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    if (!state.draft) return;
    try {
      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(state.draft));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [state.draft]);
  const setDraft = useCallback((update: SetStateAction<WorkspaceFormDraft>) => {
    setState((state) =>
      state.draft
        ? {
            ...state,
            draft: typeof update === "function" ? update(state.draft) : update,
          }
        : state,
    );
  }, []);
  return { ...state, setDraft, saveFailed, retry: () => setState(load()) };
}
