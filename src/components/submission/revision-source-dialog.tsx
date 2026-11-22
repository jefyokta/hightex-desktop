import { useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { SnapshotContent } from "./snapshot-content";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDialogViewport } from "@/hooks/use-dialog-viewport";
import { t } from "@/utils/lang";

export function RevisionSourceDialog({ snapshot, node, chapterId, onClose }: {
  snapshot: SnapshotReadModel;
  node?: JSONContent;
  chapterId?: string;
  onClose(): void;
}) {
  const viewport = useDialogViewport();
  const [images, setImages] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    if (!node) return;
    const urls = new Map([...snapshot.images].map(([key, blob]) => [key, URL.createObjectURL(blob)]));
    setImages(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [snapshot, node]);
  const nodes = useMemo(() => node ? [node] : [], [node]);
  return <Dialog open={Boolean(node)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent style={viewport} className="max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{t("mentoring.source")}</DialogTitle>
        <DialogDescription>{chapterId} · {t("submission_review.read_only")}</DialogDescription></DialogHeader>
      <SnapshotContent snapshot={snapshot} nodes={nodes} images={images} />
    </DialogContent>
  </Dialog>;
}
