import { useSyncExternalStore } from "react";

type State = LecturerDirectoryState & { loading: boolean; refreshing: boolean };
let state: State = {
  source: "",
  data: [],
  version: null,
  checkedAt: null,
  fromSeed: false,
  loading: true,
  refreshing: false,
};
let bootstrap: Promise<void> | undefined;
let refreshJob: Promise<void> | undefined;
const subscribers = new Set<() => void>();
const publish = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn());
};

export function refreshLecturerDirectory(force = false): Promise<void> {
  if (refreshJob) return refreshJob;
  const api = window.hightex?.lecturers;
  if (!api) return Promise.resolve();
  publish({ refreshing: true });
  refreshJob = api
    .refresh(force)
    .then((next) => publish({ ...next, error: next.error, loading: false }))
    .catch(() => publish({ error: "network", loading: false }))
    .finally(() => {
      refreshJob = undefined;
      publish({ refreshing: false });
    });
  return refreshJob;
}
function initialize() {
  if (bootstrap) return;
  bootstrap = (async () => {
    const api = window.hightex?.lecturers;
    if (!api) {
      publish({ loading: false });
      return;
    }
    try {
      publish({ ...(await api.cached()), loading: false });
    } catch {
      publish({ loading: false, error: "storage" });
    }
    if (navigator.onLine) await refreshLecturerDirectory();
  })();
}
const check = () => {
  if (navigator.onLine) void refreshLecturerDirectory();
};
function subscribe(fn: () => void) {
  subscribers.add(fn);
  if (subscribers.size === 1) {
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
  }
  initialize();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) {
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
    }
  };
}
const snapshot = () => state;
export function useLecturerDirectory() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
