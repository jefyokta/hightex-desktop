import { HighTexImporter } from "@/utils/import-hightex";
import { HighTexImporter as HighTexV2Importer } from "@/utils/import-v2";
import { t } from "@/utils/lang";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";

type ImportStatus = "loading" | "success" | "error";

interface ImportPayload {
  files?: string[];
}

interface ImportResult {
  path: string;
  status: "success" | "skipped" | "error";
  message?: string;
}

export const ImportDoc = () => {
  const { filePath = "" } = useParams();

  const [status, setStatus] = useState<ImportStatus>("loading");
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [overwriteFile, setOverwriteFile] = useState("");

  const overwriteResolver = useRef<((confirmed: boolean) => void) | null>(null);

  const closeWindow = useCallback(() => {
    window.ipcRenderer.send("window:close");
  }, []);

  const confirmOverwrite = useCallback(
    (name: string) =>
      new Promise<boolean>((resolve) => {
        overwriteResolver.current = resolve;
        setOverwriteFile(name);
      }),
    [],
  );

  const resolveOverwrite = useCallback((confirmed: boolean) => {
    setOverwriteFile("");
    overwriteResolver.current?.(confirmed);
    overwriteResolver.current = null;
  }, []);

  const handler = useCallback(async () => {
    const output: ImportResult[] = [];

    try {
      if (!filePath) {
        throw new Error("Import payload is empty.");
      }

    const binary = atob(
    filePath
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(filePath.length / 4) * 4, "="),
    );

    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const payload: ImportPayload = JSON.parse(decoded);

      if (
        !Array.isArray(payload.files) ||
        payload.files.length === 0 ||
        !payload.files.every(
          (path) => typeof path === "string" && path.length > 0,
        )
      ) {
        throw new Error("Invalid import payload.");
      }

      const files = [...new Set(payload.files)];

      for (let index = 0; index < files.length; index++) {
        const path = files[index];
        const name = path.split(/[\\/]/).pop() || path;

        setCurrentFile(name);

        try {
          const buffer = await window.hightex.readFile(path);
          const file = new File([new Uint8Array(buffer)], name, {
            type: "application/octet-stream",
          });

          const legacyImporter = await HighTexImporter.create(file);
          const importer =
            legacyImporter.manifest.schema_version === 2
              ? await HighTexV2Importer.create(file)
              : legacyImporter;

          if (importer.exists) {
            const confirmed = await confirmOverwrite(name);

            if (!confirmed) {
              output.push({ path, status: "skipped" });
              setResults([...output]);
              setProgress(Math.round(((index + 1) / files.length) * 100));
              continue;
            }
          }

          await importer.import();

          output.push({ path, status: "success" });
        } catch (error) {
          output.push({
            path,
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }

        setResults([...output]);
        setProgress(Math.round(((index + 1) / files.length) * 100));
      }

      const hasErrors = output.some((result) => result.status === "error");

      setStatus(hasErrors ? "error" : "success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      setStatus("error");
    }
  }, [filePath, confirmOverwrite]);

  useEffect(() => {
    void handler();
  }, [handler]);

  const imported = results.filter(
    (result) => result.status === "success",
  ).length;

  const skipped = results.filter(
    (result) => result.status === "skipped",
  ).length;

  const failed = results.filter((result) => result.status === "error").length;

  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-5 text-foreground">
      <section
        aria-labelledby="import-title"
        aria-modal="true"
        className="w-full max-w-md   bg-card p-5 "
        role="dialog"
      >
        <header className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              status === "error"
                ? "bg-destructive/10 text-destructive"
                : status === "success"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-primary/10 text-primary"
            }`}
          >
            {status === "loading" ? (
              <LoaderCircle className="size-5 animate-spin" />
            ) : status === "success" ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <CircleAlert className="size-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 id="import-title" className="font-semibold tracking-tight">
              {status === "loading"
                ? "Importing documents"
                : status === "success"
                  ? "Import complete"
                  : "Import needs attention"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === "loading"
                ? "Keep HighTex open while your files are imported."
                : status === "success"
                  ? `${imported} ${imported === 1 ? "document" : "documents"} added to your library${skipped ? ` · ${skipped} skipped` : ""}.`
                  : "Some files could not be imported. See the details below."}
            </p>
          </div>
        </header>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium" title={currentFile}>
              {currentFile || "Preparing import…"}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                failed ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        {failed > 0 && (
          <div className="mt-4 max-h-36 space-y-3 overflow-y-auto rounded-lg border p-3">
            {results
              .filter((result) => result.status === "error")
              .map((result) => (
                <div key={result.path} className="flex items-start gap-2 text-xs">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="break-all font-medium">
                      {result.path.split(/[\\/]/).pop()}
                    </p>
                    <p className="mt-1 wrap-break-word text-muted-foreground">
                      {result.message}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        {status !== "loading" && (
          <footer className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {imported} imported · {skipped} skipped · {failed} failed
            </p>
            <button
              type="button"
              onClick={closeWindow}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </footer>
        )}
      </section>

      {overwriteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="overwrite-title"
            className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-5 shadow-xl"
          >
            <div>
              <h2 id="overwrite-title" className="font-semibold">
                Replace existing document?
              </h2>
              <p className="mt-2 break-all text-sm text-muted-foreground">
                {overwriteFile}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("open_file.confirm_overwrite")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => resolveOverwrite(false)}
                className="h-9 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => resolveOverwrite(true)}
                className="h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
