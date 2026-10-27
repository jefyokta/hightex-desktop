import { FileText } from "lucide-react";
import { DocumentCover } from "@/components/printable/cover";
import { t } from "@/utils/lang";
import "@/assets/fonts/style.css";

export const SplashDocumentPreview = () => (
  <div className="splash-document" aria-hidden="true">
    <div className="splash-document-grid" />
    <div className="splash-paper splash-paper-back" />
    <div className="splash-paper splash-paper-middle" />
    <div className="splash-paper splash-paper-front">
      <div className="splash-cover-scale">
        <div className="splash-cover-page">
          <DocumentCover
            document={{ title: t("splash.preview.cover_title") }}
            profile={{ name: t("splash.preview.author"), nim: "00000000000" }}
          />
        </div>
      </div>
    </div>
    <div className="splash-cover-caption">
      <span className="splash-note-icon">
        <FileText className="size-3.5" />
      </span>
      <div>
        <div className="text-xs font-medium">
          {t("splash.preview.cover_label")}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          {t("splash.preview.cover_detail")}
        </div>
      </div>
    </div>
  </div>
);
