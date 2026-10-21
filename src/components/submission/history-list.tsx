import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { ParsedItalic } from "@/utils/parse-italic";
import { t } from "@/utils/lang";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export const SubmissionHistoryList = ({
  items,
}: {
  items: SubmissionSummary[];
}) => (
  <div className="space-y-3">
    {!items.length && (
      <div className="rounded-2xl bg-muted/30 p-8 text-center">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">
          {t("submission_review.empty")}
        </p>
      </div>
    )}
    {items.map((item) => (
      <Card key={`${item.documentId}:${item.id}`} size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              <ParsedItalic
                text={item.title || t("common.untitled_document")}
              />
            </p>
            <p className="text-sm text-muted-foreground">
              {item.studentName || t("submission_review.not_recorded")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {t(`submission_review.status.${item.status}`)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                #{item.id}
                {item.createdAt && !Number.isNaN(Date.parse(item.createdAt))
                  ? ` · ${new Date(item.createdAt).toLocaleDateString()}`
                  : ""}
              </span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link
              to={`/dashboard/submissions/${encodeURIComponent(item.documentId)}/${encodeURIComponent(item.id)}`}
            >
              {t("submission_review.open_snapshot")}
            </Link>
          </Button>
        </CardContent>
      </Card>
    ))}
  </div>
);
