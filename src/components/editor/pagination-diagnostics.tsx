import type { Editor } from "@tiptap/core";
import type { PaginationDiagnostic } from "@/types/pagination/diagnostic";
import { useScannerNavigation } from "@/hooks/use-scanner-navigation";
import { t } from "@/utils/lang";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

export function PaginationDiagnostics({
  diagnostics,
  editor,
}: {
  diagnostics: readonly PaginationDiagnostic[];
  editor?: Editor;
}) {
  const navigate = useScannerNavigation(editor);
  return (
    <Collapsible
      className="rounded-lg border text-xs"
      data-pagination-diagnostics
    >
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="group w-full justify-between px-3 text-xs">
          {t("editor.pagination.diagnostics", { count: diagnostics.length })}
          <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="max-h-64 space-y-3 overflow-auto border-t p-3">
          {diagnostics.map((issue, index) => (
            <li key={index} className="space-y-1">
              <p className="whitespace-pre-wrap break-words">{issue.message}</p>
              {issue.source && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">
                    {issue.source.chapterId} ·{" "}
                    {issue.source.nodeId ??
                      `PM ${issue.source.from}..${issue.source.to}`}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-pagination-open-source
                    onClick={() =>
                      void navigate({
                        pluginId: "pagination",
                        code: issue.code,
                        severity: issue.level === "fatal" ? "error" : "warning",
                        message: issue.message,
                        chapterId: issue.source!.chapterId,
                        nodeId: issue.source!.nodeId,
                        source: issue.source,
                      })
                    }
                  >
                    {t("editor.pagination.open_source")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
