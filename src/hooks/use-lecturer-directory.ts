import { useSyncExternalStore } from "react";

type State = LecturerDirectoryState & { loading: boolean };
let state: State = { data: [], loading: true };
let bootstrap: Promise<void> | undefined;
const subscribers = new Set<() => void>();
const publish = (next: LecturerDirectoryState) => {
  state = { ...next, loading: false };
  subscribers.forEach((fn) => fn());
};

export async function loadLecturerDirectory(): Promise<void> {
  try {
    const api = window.hightex?.lecturers;
    publish(api ? await api.list() : { data: [], error: "storage" });
  } catch {
    publish({
      data: state.data,
      error: "storage",
    });
  }
}

export async function saveLecturer(input: LecturerDirectoryInput) {
  // Finish the initial read before publishing a mutation's newer state.
  if (bootstrap) await bootstrap;
  const result = await window.hightex.lecturers.save(input);
  publish({ data: result.data });
  return result.entry;
}

export async function removeLecturer(id: string) {
  if (bootstrap) await bootstrap;
  publish(await window.hightex.lecturers.remove(id));
}

export async function importLecturers(data: unknown, filename?: string) {
  if (bootstrap) await bootstrap;
  const result = await window.hightex.lecturers.import(data, filename);
  publish({ data: result.data });
  return result;
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  bootstrap ??= loadLecturerDirectory();
  return () => {
    subscribers.delete(fn);
  };
}
const snapshot = () => state;
export function useLecturerDirectory() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
