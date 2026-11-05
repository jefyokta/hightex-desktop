import { t } from "@/utils/lang";

export function LecturerSourceLabel({ source }: { source: LecturerSource }) {
  const key =
    source.type === "manual"
      ? "lecturers.source_manual"
      : source.type === "file"
        ? "lecturers.source_file"
        : source.type === "cloud"
          ? "lecturers.source_cloud"
          : "lecturers.source_unknown";
  return (
    <div
      className="space-y-0.5 text-xs text-muted-foreground"
      data-lecturer-source={source.type}
    >
      <span>{t(key)}</span>
      {source.type === "file" && source.filename && (
        <p className="break-all text-xs text-muted-foreground">
          {source.filename}
        </p>
      )}
      {source.type === "cloud" && (
        <a
          href={source.url}
          className="block break-all text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={(event) => {
            event.preventDefault();
            void window.file.openExternal(source.url);
          }}
        >
          {source.url}
        </a>
      )}
    </div>
  );
}
