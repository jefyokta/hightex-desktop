import { useIPC } from "@/hooks/use-ipc";
import { useEffect, useRef, useState } from "react";
import type { CreateRevision, GuidanceList, GuidanceRevision, GuidanceTarget, RevisionAction, RevisionAnchor, UpdateRevision } from "../../shared/guidance-contract";
import { t } from "@/utils/lang";

export type RevisionWrite = { kind: "create"; input: CreateRevision } | { kind: "update"; input: UpdateRevision };

/** One target owns reads and pending writes; retries retain their request identity. */
export function useGuidanceRevisions(target?: GuidanceTarget, onAccessDenied?: (code: SubmissionErrorCode) => void) {
  const key = JSON.stringify([target?.sessionId, target?.documentId, target?.submissionId]);
  const [scope, setScope] = useState(key);
  const [state, setState] = useState<GuidanceList>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<RevisionWrite>();
  const [confirmed, setConfirmed] = useState<RevisionWrite>();
  const generation = useRef(0);
  const activeTarget = useRef(key);
  activeTarget.current = key;
  const operation = useRef<{ key: string; generation: number }>();
  const isCurrent = (request: number) => request === generation.current && key === activeTarget.current;

  const confirm = (write: RevisionWrite) => {
    setConfirmed(write);
    setPending(undefined);
  };

  const accept = (result: SubmissionResult<GuidanceList>, request: number) => {
    if (!isCurrent(request)) return false;
    if (result.ok) {
      setState(result.data);
      setError("");
      return true;
    }
    setError(result.error.code === "state_changed" ? t("mentoring.changed") : t(`submission_review.errors.${result.error.code}`));
    if (["forbidden", "not_authenticated", "session_changed"].includes(result.error.code)) {
      setState(undefined);
      onAccessDenied?.(result.error.code);
    }
    return false;
  };

  const load = async (request: number) => {
    if (!target) return false;
    const result = await useIPC("hightex").hightex.submission.revisions.list(target);
    if (result.ok && isCurrent(request) && scope === key && pending) {
      const confirmed = pending.kind === "create"
        ? result.data.items.some(item => item.id === pending.input.id)
        : result.data.items.some(item => item.events.some(event => event.requestId === pending.input.requestId));
      if (confirmed) confirm(pending);
    }
    return accept(result, request);
  };

  useEffect(() => {
    const request = ++generation.current;
    setScope(key);
    setState(undefined);
    setPending(undefined);
    setConfirmed(undefined);
    setError("");
    setBusy(Boolean(target));
    void load(request).catch(() => { if (isCurrent(request)) setError(t("mentoring.unavailable")); })
      .finally(() => { if (isCurrent(request)) setBusy(false); });
    return () => { generation.current++; };
  }, [target?.sessionId, target?.documentId, target?.submissionId]);

  const run = async (write?: RevisionWrite) => {
    if (!target || (operation.current?.key === key && operation.current.generation === generation.current)) return false;
    const currentOperation = { key, generation: generation.current };
    operation.current = currentOperation;
    const request = generation.current;
    setBusy(true);
    setError("");
    try {
      if (!write) return await load(request);
      setPending(write);
      const result = write.kind === "create"
        ? await useIPC("hightex").hightex.submission.revisions.create(write.input)
        : await useIPC("hightex").hightex.submission.revisions.update(write.input);
      const success = accept(result, request);
      const rejected = !result.ok && (["state_changed", "forbidden", "not_authenticated", "session_changed", "not_found"].includes(result.error.code) || result.error.status === 422);
      if (success) confirm(write);
      else if (isCurrent(request) && rejected) setPending(undefined);
      return success;
    } catch {
      if (isCurrent(request)) setError(t("mentoring.failed"));
      return false;
    } finally {
      if (operation.current === currentOperation) operation.current = undefined;
      if (isCurrent(request)) setBusy(false);
    }
  };

  const create = (instruction: string, anchor: RevisionAnchor) => target && run({
    kind: "create", input: { ...target, id: crypto.randomUUID(), instruction: instruction.trim(), anchor },
  });
  const update = (revision: GuidanceRevision, action: RevisionAction, message?: string) => target && run({
    kind: "update", input: { ...target, revisionId: revision.id, requestId: crypto.randomUUID(), version: revision.version, action, message: message?.trim() },
  });
  const visible = scope === key;
  return {
    state: visible ? state : undefined,
    busy: visible ? busy : Boolean(target),
    error: visible ? error : "",
    pending: visible && Boolean(pending),
    confirmed: visible ? confirmed : undefined,
    create, update, refresh: () => run(), retry: () => visible ? run(pending) : undefined,
  };
}
