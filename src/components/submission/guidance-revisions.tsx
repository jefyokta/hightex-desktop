import { useEffect, useMemo, useState } from "react";
import { CheckCheck, ListTodo, MessageSquare, RotateCcw } from "lucide-react";
import type { GuidanceRevision, GuidanceTarget, RevisionAction, RevisionAnchor } from "../../../shared/guidance-contract";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { revisionLocations } from "@/review/revision-anchor";
import { useGuidanceRevisions, type RevisionWrite } from "@/hooks/use-guidance-revisions";
import { useAppLanguage } from "@/hooks/use-app-language";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { t } from "@/utils/lang";

export function GuidanceRevisions({ snapshot, target, onSource, onAccessDenied }: {
  snapshot?: SnapshotReadModel;
  target?: GuidanceTarget;
  onSource?(anchor: RevisionAnchor): void;
  onAccessDenied?(code: SubmissionErrorCode): void;
}) {
  useAppLanguage();
  const source = snapshot?.source;
  const form = useGuidanceRevisions(source?.kind === "submission" ? {
    sessionId: source.session.sessionId, documentId: source.documentId, submissionId: source.submissionId,
  } : target, onAccessDenied);
  const [instruction, setInstruction] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const write = form.confirmed;
    if (write?.kind === "create") setInstruction(value => value.trim() === write.input.instruction ? "" : value);
  }, [form.confirmed]);
  const locations = useMemo(() => snapshot ? revisionLocations(snapshot) : [], [snapshot]);
  const filtered = locations.filter(location => location.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selectedLocation = locations.find(location => `${location.anchor.chapterId}:${location.anchor.path.join(".")}` === selected);
  const locked = form.busy || form.pending;
  const create = () => {
    if (selectedLocation) void form.create(instruction, selectedLocation.anchor);
  };

  return <section data-guidance-revisions className="space-y-4">
    <header className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><ListTodo className="size-4" />{t("mentoring.revisions")}</h2>
      <Button size="icon-sm" variant="ghost" disabled={form.busy} onClick={() => void form.refresh()} aria-label={t("mentoring.refresh")}><RotateCcw className="size-4" /></Button>
    </header>
    {form.error && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-xs text-destructive">{form.error}</p>}
    {form.pending && <div className="space-y-2 rounded-lg border p-3 text-xs">
      <p>{t("submission_review.errors.outcome_unknown")}</p>
      <Button size="sm" variant="outline" disabled={form.busy} onClick={() => void form.retry()}>{t("dashboard.retry")}</Button>
    </div>}
    {snapshot && form.state?.canManage && <form className="space-y-3 rounded-xl border bg-muted/20 p-3" onSubmit={event => { event.preventDefault(); void create(); }}>
      <label className="block space-y-2 text-xs font-medium">
        <span>{t("mentoring.target")}</span>
        <Input type="search" value={query} disabled={locked} onChange={event => setQuery(event.target.value)} placeholder={t("mentoring.target")} />
        <NativeSelect value={selected} disabled={locked} onChange={event => setSelected(event.target.value)}>
          <option value="">{t("mentoring.target")}</option>
          {filtered.map(location => {
            const key = `${location.anchor.chapterId}:${location.anchor.path.join(".")}`;
            return <option key={key} value={key}>{location.label}</option>;
          })}
        </NativeSelect>
      </label>
      {selectedLocation && <button type="button" onClick={() => onSource?.(selectedLocation.anchor)} className="block text-left text-xs text-muted-foreground underline">{selectedLocation.anchor.quote.slice(0, 180)}</button>}
      <label className="block space-y-2 text-xs font-medium"><span>{t("mentoring.instruction")}</span>
        <Textarea value={instruction} disabled={locked} onChange={event => setInstruction(event.target.value)} maxLength={4000} className="min-h-24" /></label>
      <Button size="sm" disabled={locked || !selectedLocation || !instruction.trim()}>{t("mentoring.create")}</Button>
    </form>}
    {form.busy && !form.state && <p role="status" className="text-xs text-muted-foreground">{t("common.loading")}</p>}
    {form.state && !form.state.items.length && <p className="py-5 text-center text-sm text-muted-foreground">{t("mentoring.empty")}</p>}
    {form.state?.items.map(revision => <RevisionCard key={revision.id} revision={revision}
      disabled={locked} canManage={form.state!.canManage && revision.reviewerId === form.state!.session.accountId}
      canProgress={form.state!.canProgress && revision.reviewerId === form.state!.recipientId} onSource={onSource ? () => onSource(revision.anchor) : undefined}
      confirmed={form.confirmed} onAction={(action, message) => form.update(revision, action, message)} />)}
  </section>;
}

function RevisionCard({ revision, disabled, canManage, canProgress, onSource, onAction, confirmed }: {
  revision: GuidanceRevision;
  disabled: boolean;
  canManage: boolean;
  canProgress: boolean;
  onSource?(): void;
  onAction(action: RevisionAction, message?: string): Promise<boolean> | undefined;
  confirmed?: RevisionWrite;
}) {
  const [reply, setReply] = useState("");
  useEffect(() => {
    if (confirmed?.kind === "update" && confirmed.input.revisionId === revision.id && confirmed.input.action === "reply") {
      setReply(value => value.trim() === confirmed.input.message ? "" : value);
    }
  }, [confirmed, revision.id]);
  return <article data-revision-id={revision.id} className="space-y-3 rounded-xl border bg-background p-4">
    <Badge variant="secondary">{t(`mentoring.${revision.status}`)}</Badge>
    <p className="whitespace-pre-wrap text-sm leading-relaxed">{revision.instruction}</p>
    <button type="button" disabled={!onSource} onClick={onSource} className="block w-full border-l-2 pl-3 text-left text-xs text-muted-foreground">
      {revision.anchor.chapterId} · {revision.anchor.quote.slice(0, 180)}
    </button>
    <ol className="space-y-2 border-t pt-3">
      {revision.events.filter(event => event.action !== "created").map(event => <li key={event.id} className="space-y-1 text-xs">
        <p className="font-medium">{event.author || event.authorId} <span className="font-normal text-muted-foreground">· {event.action === "reply" || event.action === "created" ? t("mentoring.send") : t(`mentoring.${event.action}`)}</span></p>
        {event.message && <p className="whitespace-pre-wrap text-muted-foreground">{event.message}</p>}
      </li>)}
    </ol>
    <div className="flex flex-wrap gap-2">
      {canProgress && revision.status !== "resolved" && <>
        {revision.status !== "in_progress" && <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onAction("in_progress")}>{t("mentoring.start")}</Button>}
        {revision.status !== "ready" && <Button size="sm" disabled={disabled} onClick={() => void onAction("ready")}>{t("mentoring.mark_ready")}</Button>}
      </>}
      {canManage && <Button size="sm" variant="outline" disabled={disabled} onClick={() => void onAction(revision.status === "resolved" ? "open" : "resolved")}>
        <CheckCheck className="size-3.5" />{t(revision.status === "resolved" ? "mentoring.reopen" : "mentoring.resolve")}
      </Button>}
    </div>
    {(canManage || canProgress) && <form className="space-y-2" onSubmit={event => {
      event.preventDefault(); void onAction("reply", reply);
    }}>
      <Textarea disabled={disabled} value={reply} onChange={event => setReply(event.target.value)} maxLength={4000}
        aria-label={t("mentoring.reply")} placeholder={t("mentoring.reply")} className="min-h-16 text-xs" />
      <Button size="sm" variant="ghost" disabled={disabled || !reply.trim()}><MessageSquare className="size-3.5" />{t("mentoring.send")}</Button>
    </form>}
  </article>;
}
