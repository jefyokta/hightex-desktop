import { useEffect, useState } from "react";

interface ZoteroSearchState {
  query: string;
  scope: string;
  items: ZoteroItem[];
  loading: boolean;
  unavailable: boolean;
}

const emptyItems: readonly ZoteroItem[] = [];

/** Local results stay independent; outdated Zotero responses never replace the current query. */
export function useZoteroSearch(query: string, config?: ConfigShape["zotero"], enabled = true) {
  const text = query.trim();
  const scope = `${config?.host}:${config?.port}`;
  const active = enabled && Boolean(config?.enabled) && text.length > 0;
  const [state, setState] = useState<ZoteroSearchState>();

  useEffect(() => {
    if (!active || !config) return;
    let current = true;
    const { host, port } = config;
    const timer = setTimeout(() => {
      setState({ query: text, scope, items: [], loading: true, unavailable: false });
      void window.zotero.searchItems(host, port, text).then(items => {
        if (current) setState({ query: text, scope, items, loading: false, unavailable: false });
      }).catch(() => {
        if (current) setState({ query: text, scope, items: [], loading: false, unavailable: true });
      });
    }, 200);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, scope, active, config?.host, config?.port]);

  const result = active && state?.query === text && state.scope === scope ? state : undefined;
  return {
    items: result?.items ?? emptyItems,
    loading: active && (result?.loading ?? true),
    unavailable: result?.unavailable ?? false,
  };
}
