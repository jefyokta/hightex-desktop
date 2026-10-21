import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Eye,
  Layout,
  LockKeyhole,
  RefreshCw,
  ZoomIn,
} from "lucide-react";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { resolveDocumentProfile } from "@/utils/document-profile";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";
import { Alert, AlertDescription } from "../ui/alert";
import { PreviewFrame } from "./preview-frame";

export const SubmissionSnapshotViewer = ({
  snapshot,
  onBack,
}: {
  snapshot: SnapshotReadModel;
  onBack(): void;
}) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameKey, setFrameKey] = useState(() => crypto.randomUUID());
  const [zoom, setZoom] = useState(40);
  const [layoutIndicator, setLayoutIndicator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const profile = resolveDocumentProfile(snapshot.document);

  useEffect(() => {
    let active = true;
    const target =
      window.location.origin === "null" ? "*" : window.location.origin;
    const initialize = async () => {
      const categories = await window.hightex.categories();
      if (!active) return;
      frameRef.current?.contentWindow?.postMessage(
        {
          type: "snapshot:preview:init",
          request: frameKey,
          file: snapshot.originalFile(),
          source: snapshot.source,
          categories,
        },
        target,
      );
    };
    const listener = (event: MessageEvent) => {
      if (
        event.source !== frameRef.current?.contentWindow ||
        event.origin !== window.location.origin ||
        event.data?.request !== frameKey
      )
        return;
      if (event.data.type === "snapshot:preview:ready")
        void initialize().catch(() => {
          if (active) {
            setError(t("submission_review.errors.preview_failed"));
            setLoading(false);
          }
        });
      if (event.data.type === "snapshot:preview:error") {
        setError(
          t(
            event.data.code === "snapshot_category_missing"
              ? "submission_review.errors.snapshot_category_missing"
              : "submission_review.errors.preview_failed",
          ),
        );
        setLoading(false);
      }
    };
    window.addEventListener("message", listener);
    const timer = setTimeout(() => {
      if (active) {
        setError(t("submission_review.errors.preview_failed"));
        setLoading(false);
      }
    }, 60000);
    const rendered = (event: MessageEvent) => {
      if (
        event.source === frameRef.current?.contentWindow &&
        event.data?.type === "page:rendered"
      ) {
        clearTimeout(timer);
        setLoading(false);
      }
    };
    window.addEventListener("message", rendered);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("message", listener);
      window.removeEventListener("message", rendered);
    };
  }, [snapshot, frameKey]);

  const reload = () => {
    setError(undefined);
    setLoading(true);
    setFrameKey(crypto.randomUUID());
  };
  const download = async () => {
    setSaving(true);
    try {
      const name =
        snapshot.source.kind === "submission"
          ? `submission-${snapshot.source.submissionId}.hightex`
          : "document.hightex";
      await window.ipcRenderer.invoke(
        "hightex:export",
        snapshot.originalFile(),
        name,
        { showDialog: true },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex flex-col gap-3 h-[calc(100vh-6rem)] min-h-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t("submission_review.back")}
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">
            <ParsedItalic
              text={snapshot.document.title || t("common.untitled_document")}
            />
          </h1>
          <p className="text-xs text-muted-foreground">
            {snapshot.source.kind === "submission"
              ? t("submission_review.snapshot_label", {
                  id: snapshot.source.submissionId,
                })
              : t("submission_review.local_label")}
          </p>
        </div>
        <Badge variant="secondary">
          <LockKeyhole className="size-3" />
          {t("submission_review.read_only")}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={download}
        >
          <Download className="size-4" />
          {t("submission_review.download")}
        </Button>
      </header>
      {(error ||
        profile.incomplete ||
        snapshot.unsupportedNodes.length > 0) && (
        <Alert variant={error ? "destructive" : "default"}>
          <AlertDescription>
            {error && <p>{error}</p>}
            {profile.incomplete && (
              <p>{t("submission_review.missing_profile")}</p>
            )}
            {snapshot.unsupportedNodes.length > 0 && (
              <p>{t("submission_review.unsupported_content")}</p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3 w-full pb-2 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-35 text-xs">
          <Eye className="w-4 h-4 opacity-60 shrink-0" />
          Full Document
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-40 max-w-60 border rounded-lg px-2 py-1 h-8 bg-background">
          <ZoomIn className="w-4 h-4 opacity-60 shrink-0" />
          <span className="text-xs text-muted-foreground select-none w-8 text-right">
            {zoom}%
          </span>
          <Slider
            value={[zoom]}
            min={10}
            max={100}
            step={5}
            onValueChange={(values) => setZoom(values[0])}
            className="flex-1 cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={reload}
            aria-label={t("submission_review.refresh")}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1 h-8 bg-background">
            <Layout className="w-4 h-4 opacity-60" />
            <span className="text-xs text-muted-foreground select-none">
              Layout
            </span>
            <Switch
              checked={layoutIndicator}
              onCheckedChange={setLayoutIndicator}
            />
          </div>
        </div>
      </div>
      <PreviewFrame
        src={`/submission/print/${encodeURIComponent(snapshot.document.id)}?request=${frameKey}`}
        frameKey={frameKey}
        frameRef={frameRef}
        zoom={zoom}
        layoutIndicator={layoutIndicator}
        loading={loading}
        onRendered={() => setLoading(false)}
        onError={() => {
          setError(t("submission_review.errors.preview_failed"));
          setLoading(false);
        }}
      />
    </main>
  );
};
