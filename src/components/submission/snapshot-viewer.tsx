import { useEffect, useState } from "react";
import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import type { SnapshotReadModel } from "@/review/snapshot-reader";
import { resolveDocumentProfile } from "@/utils/document-profile";
import { sanitizeCvHtml } from "@/utils/sanitize-cv-html";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { formatInTextCitation } from "@/utils/citation";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Paper } from "../paper";
import { SnapshotContent } from "./snapshot-content";
import "@/css/snapshot-review.css";

const formatReference = (key: string, bib: string) => {
  try {
    return formatInTextCitation([{ key, bib }]).biblios[0] ?? bib;
  } catch {
    return bib;
  }
};

export const SubmissionSnapshotViewer = ({
  snapshot,
  onBack,
}: {
  snapshot: SnapshotReadModel;
  onBack(): void;
}) => {
  const [section, setSection] = useState("profile");
  const [images, setImages] = useState<ReadonlyMap<string, string>>(new Map());
  const [picture, setPicture] = useState<string>();
  const [saving, setSaving] = useState(false);
  const profile = resolveDocumentProfile(snapshot.document);
  const chapter = snapshot.chapters.find(
    (chapter) => `chapter:${chapter.id}` === section,
  );

  useEffect(() => {
    const urls = new Map<Blob, string>();
    const url = (blob: Blob) => {
      if (!urls.has(blob)) urls.set(blob, URL.createObjectURL(blob));
      return urls.get(blob)!;
    };
    setImages(
      new Map([...snapshot.images].map(([key, blob]) => [key, url(blob)])),
    );
    setPicture(
      snapshot.document.profile?.picture
        ? url(snapshot.document.profile.picture)
        : undefined,
    );
    return () => urls.forEach((value) => URL.revokeObjectURL(value));
  }, [snapshot]);

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
    <main className="space-y-5 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          {t("submission_review.back")}
        </Button>
        <div className="flex items-center gap-2">
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
        </div>
      </header>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          <ParsedItalic
            text={snapshot.document.title || t("common.untitled_document")}
          />
        </h1>
        <p className="text-sm text-muted-foreground">
          {snapshot.source.kind === "submission"
            ? t("submission_review.snapshot_label", {
                id: snapshot.source.submissionId,
              })
            : t("submission_review.local_label")}
        </p>
      </div>
      {(profile.incomplete || snapshot.unsupportedNodes.length > 0) && (
        <Alert>
          <AlertDescription>
            {profile.incomplete && (
              <p>{t("submission_review.missing_profile")}</p>
            )}
            {snapshot.unsupportedNodes.length > 0 && (
              <p>{t("submission_review.unsupported_content")}</p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Select value={section} onValueChange={setSection}>
        <SelectTrigger className="w-full sm:w-80">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="profile">
            {t("submission_review.author")}
          </SelectItem>
          {snapshot.chapters.map((chapter) => (
            <SelectItem key={chapter.id} value={`chapter:${chapter.id}`}>
              {t("submission_review.chapter", { id: chapter.id })}
            </SelectItem>
          ))}
          <SelectItem value="cv">{t("submission_review.cv")}</SelectItem>
          <SelectItem value="references">
            {t("submission_review.references")}
          </SelectItem>
        </SelectContent>
      </Select>
      <div className="overflow-x-auto rounded-lg bg-muted/30 p-3 sm:p-6">
        <Paper className="mx-auto text-black dark:bg-white">
          {section === "profile" && (
            <div className="space-y-5">
              <h1 className="text-center text-[14pt] font-bold">
                <ParsedItalic text={snapshot.document.title} />
              </h1>
              <dl className="space-y-3">
                {[
                  [t("settings.profile.name.label"), profile.name],
                  [t("settings.profile.nim.label"), profile.nim],
                  [
                    t("settings.profile.advisor.name.label"),
                    profile.advisorName,
                  ],
                  [t("settings.profile.advisor.nip.label"), profile.advisorNip],
                  ...(profile.secondAdvisor
                    ? [
                        [
                          t("settings.profile.second_advisor.name.label"),
                          profile.secondAdvisor.name,
                        ],
                        [
                          t("settings.profile.second_advisor.nip.label"),
                          profile.secondAdvisor.nip,
                        ],
                      ]
                    : []),
                  ...(snapshot.document.config.intern
                    ? [
                        [
                          t("editor.expandable.setting.onsite_location"),
                          snapshot.document.config.intern.onsite_at,
                        ],
                        [
                          t(
                            "editor.expandable.setting.internship_advisor_name",
                          ),
                          snapshot.document.config.intern.advisor?.name,
                        ],
                      ]
                    : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-bold">{label}</dt>
                    <dd>
                      {typeof value === "string" && value
                        ? value
                        : t("submission_review.not_recorded")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {chapter && (
            <SnapshotContent
              snapshot={snapshot}
              nodes={chapter.content}
              images={images}
            />
          )}
          {section === "cv" && (
            <div className="snapshot-content text-justify">
              <h1>{t("submission_review.cv")}</h1>
              {picture && (
                <img
                  src={picture}
                  alt={t("document_profile.picture")}
                  className="float-left mr-[10pt] mb-[5pt]"
                  style={{ width: "3cm", height: "4cm", objectFit: "cover" }}
                />
              )}
              {profile.cv ? (
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizeCvHtml(profile.cv),
                  }}
                />
              ) : (
                <p>{t("submission_review.not_recorded")}</p>
              )}
            </div>
          )}
          {section === "references" && (
            <div className="snapshot-content">
              <h1>{t("submission_review.references")}</h1>
              {Object.keys(snapshot.references).length === 0 && (
                <p>{t("submission_review.not_recorded")}</p>
              )}
              {Object.entries(snapshot.references).map(([key, bib]) => (
                <div key={key} className="mb-5">
                  <p className="font-bold">{key}</p>
                  <p className="whitespace-pre-wrap">
                    {formatReference(key, bib)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Paper>
      </div>
    </main>
  );
};
