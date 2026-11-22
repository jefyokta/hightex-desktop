import { AlertCircle, Loader2, Save } from "lucide-react";
import type { DocumentSaveState } from "@/editor/document/files/contracts";
import { useAppLanguage } from "@/hooks/use-app-language";
import { t } from "@/utils/lang";
import { cn } from "@/lib/utils";

type SaveStatus = "saving" | "error" | "external_changed" | "local" | "modified" | "file_saved";

const indicators = {
  warning: "bg-amber-600 dark:bg-amber-400",
  local: "bg-sky-600 dark:bg-sky-400",
  saved: "bg-emerald-600 dark:bg-emerald-400",
};

const appearances = {
  saving: { icon: Loader2, indicator: indicators.warning },
  error: { icon: AlertCircle, indicator: indicators.warning },
  external_changed: { icon: AlertCircle, indicator: indicators.warning },
  local: { icon: Save, indicator: indicators.local },
  modified: { icon: Save, indicator: indicators.warning },
  file_saved: { icon: Save, indicator: indicators.saved },
};

function saveStatus(state: DocumentSaveState): SaveStatus {
  if (state.saving) return "saving";
  if (state.error) return "error";
  if (state.externalChanged) return "external_changed";
  if (!state.path || state.missing) return "local";
  return state.modified ? "modified" : "file_saved";
}

export function describeSaveState(state: DocumentSaveState) {
  const status = saveStatus(state);
  let hint = t("editor.save.local_hint");
  if (state.externalChanged) hint = t("editor.save.external_hint");
  else if (state.missing) hint = t("editor.save.missing_hint");

  return { status, label: t(`editor.save.${status}`), hint, ...appearances[status] };
}

interface Props {
  state: DocumentSaveState;
  presentation: ReturnType<typeof describeSaveState>;
}

export function DocumentFileStatus({ state, presentation }: Props) {
  const language = useAppLanguage();
  const fileName = state.path?.split(/[\\/]/).pop();
  const date = state.savedAt && new Intl.DateTimeFormat(language, {
    dateStyle: "medium", timeStyle: "short",
  }).format(state.savedAt);

  return (
    <div data-document-file-status className="px-2.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
          <Save className="size-3.5 text-muted-foreground" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium" title={fileName}>
            {fileName || t("editor.save.no_file")}
          </p>
          <p role="status" className={cn(
            "mt-1 text-[11px] text-muted-foreground",
            presentation.status === "file_saved" && "text-emerald-700 dark:text-emerald-400",
          )}>
            {presentation.label}
          </p>
        </div>
      </div>
      {state.path && (
        <p className="mt-2 line-clamp-2 text-[10px] leading-4 break-all text-muted-foreground" title={state.path}>
          {state.path}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{presentation.hint}</p>
      {date && !state.modified && <p className="mt-1 text-[10px] text-muted-foreground">{date}</p>}
      {state.error && (
        <div role="alert" className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
          <p className="text-xs font-medium">{t(`editor.save.errors.${state.error.code}`)}</p>
          <p className="mt-1 max-h-24 overflow-y-auto text-[10px] leading-4 break-words text-muted-foreground">
            {state.error.detail}
          </p>
        </div>
      )}
    </div>
  );
}
