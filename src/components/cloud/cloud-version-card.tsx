import { useState } from "react";
import { ArrowDownToLine, Check, ChevronDown, Cloud, Copy, Link2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CloudCommit } from "@/cloud/documents";
import type { CloudDownloadTarget } from "@/cloud/document-download";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { timeAgo } from "./version-time";

interface Props {
  current?: CloudCommit;
  linkedDocument?: HighTexDocument;
  selectedBinding?: CloudBinding | null;
  online: boolean;
  loaded: boolean;
  busy: boolean;
  showSkeleton: boolean;
  pullingSha: string | null;
  onDownload(target: CloudDownloadTarget): void;
}

export function CloudVersionCard({
  current, linkedDocument, selectedBinding, online, loaded,
  busy, showSkeleton, pullingSha, onDownload,
}: Props) {
  const [showTech, setShowTech] = useState(false);

  return (
    <section className="rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Cloud className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{t("remote.cloud_version")}</h2>
            {showSkeleton ? (
              <div
                className="mt-2 h-4 w-44 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800"
                aria-hidden
              />
            ) : current?.sha256 ? (
              <div className="mt-0.5 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {current.created_at
                    ? t("remote.saved_at", {
                        time: timeAgo(current.created_at),
                      })
                    : t("remote.stored_in_cloud")}
                </p>
                <p className="wrap-break-word text-sm">
                  {current.message || (
                    <span className="text-muted-foreground">
                      {t("remote.no_note")}
                    </span>
                  )}
                </p>
                {linkedDocument && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link2 className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {t("remote.linked_to")}{" "}
                      <ParsedItalic
                        text={linkedDocument.title || t("remote.untitled")}
                      />
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {online && loaded
                  ? t("remote.no_cloud_version")
                  : t("remote.cloud_status_unavailable")}
              </p>
            )}
          </div>
        </div>

        {current?.sha256 && loaded && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownload({ kind: "latest" })}
              disabled={!online || busy}
            >
              {pullingSha === "latest" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="size-4" />
              )}
              {linkedDocument
                ? t("remote.update_local_copy")
                : t("remote.download_document")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload({ kind: "copy" })}
              disabled={!online || busy}
            >
              {t("remote.download_copy")}
            </Button>
          </div>
        )}
      </div>

      {current?.sha256 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowTech((value) => !value)}
            aria-expanded={showTech}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("remote.technical_details")}
            <ChevronDown
              className={`size-3.5 transition-transform ${
                showTech ? "rotate-180" : ""
              }`}
            />
          </button>
          {showTech && (
            <dl className="mt-3 space-y-3 rounded-xl bg-white px-4 py-3 dark:bg-neutral-950">
              <TechRow
                label={t("remote.server_id")}
                value={current.document_id}
              />
              <TechRow label={t("remote.local_id")} value={linkedDocument?.id} />
              <TechRow label={t("remote.sha256")} value={current.sha256} />
              <TechRow
                label={t("remote.selected_draft_base_sha256")}
                value={selectedBinding?.baseSha256}
              />
            </dl>
          )}
        </div>
      )}
    </section>
  );
}

function TechRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-start gap-1">
        <span className="min-w-0 flex-1 break-all font-mono text-xs">
          {value || t("remote.not_linked_status")}
        </span>
        {value && <CopyButton value={value} label={label} />}
      </dd>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("citation.copy_failed"));
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Salin ${label}`}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
