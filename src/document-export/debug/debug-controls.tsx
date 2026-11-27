import { useIPC } from "@/hooks/use-ipc";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bug, ChevronDown, ChevronLeft, ChevronRight, FileDown, Loader2, MousePointer2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import styles from "@/css/editor-pdf-debug.css?inline";
import { paginationReport } from "@/editor/pagination/report-error";
import type { ShouldReport } from "@/exception/should-report";
import { documentLinkTarget } from "../../../shared/document-link";

/** Inspection controls own presentation only; export always sends the original frozen snapshot. */
export function EditorPDFDebugControls({ snapshot }: { snapshot: EditorPDFSnapshot }) {
  const [busy, setBusy] = useState(false);
  const request = useRef<string>();
  const [error, setError] = useState<{ detail: string; report?: ShouldReport }>();
  const [saved, setSaved] = useState<{ path: string; filename: string }>();
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const sections = useMemo(() => {
    const html = new DOMParser().parseFromString(snapshot.html, "text/html");
    return snapshot.sections.map(section => {
      const context = html.querySelector(`[data-print-context="${snapshot.projection.views[section.firstPage - 1].context}"]`);
      const heading = context?.querySelector(".tiptap h1") ?? context?.querySelector("h1");
      return { ...section, title: heading?.textContent?.trim() || section.id };
    });
  }, [snapshot]);
  const section = sections.find(item => page + 1 >= item.firstPage && page + 1 < item.firstPage + item.pages);
  const view = snapshot.projection.views[page];

  const failed = useCallback((cause: unknown) => setError({
    detail: cause instanceof Error ? cause.message : String(cause),
    report: paginationReport(cause, "Debug PDF experimental"),
  }), []);
  const selectPage = useCallback((next: number) => {
    try {
      window.editorPDFViewport!.select(next, snapshot.fingerprint);
      setPage(next);
      setPageInput(String(next + 1));
      setError(undefined);
      document.querySelector("[data-editor-pdf-debug-surface]")?.scrollTo(0, 0);
    } catch (error) { failed(error); }
  }, [snapshot.fingerprint, failed]);
  useEffect(() => {
    const canvas = document.querySelector("[data-editor-pdf-debug-surface]");
    const navigate = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link) return;
      const id = documentLinkTarget(link.getAttribute("href")!);
      const target = snapshot.projection.targets.find(target => target.id === id);
      if (!target) return;
      event.preventDefault();
      selectPage(target.page - 1);
    };
    canvas?.addEventListener("click", navigate);
    return () => canvas?.removeEventListener("click", navigate);
  }, [snapshot, selectPage]);
  const jumpToPage = () => {
    const next = Number(pageInput);
    if (Number.isInteger(next) && next >= 1 && next <= snapshot.pages) selectPage(next - 1);
    else setPageInput(String(page + 1));
  };
  const cancel = () => {
    const id = request.current;
    request.current = undefined;
    setBusy(false);
    if (id) void useIPC("editorPDFExperimental").editorPDFExperimental.cancel(id).catch(failed);
  };
  useEffect(() => () => {
    // The main-process sender lifecycle owns cancellation when this window closes.
    request.current = undefined;
  }, []);

  const exportSnapshot = async () => {
    if (request.current) return;
    const id = crypto.randomUUID();
    request.current = id;
    setBusy(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const result = await useIPC("editorPDFExperimental").editorPDFExperimental.export(snapshot, id);
      if (request.current === id && result) setSaved(result);
    } catch (error) {
      if (request.current === id) failed(error);
    } finally {
      if (request.current === id) {
        request.current = undefined;
        setBusy(false);
      }
    }
  };
  const inspectPage = () => {
    try {
      const canvas = document.querySelector("[data-editor-pdf-debug-surface]")!,
        paper = canvas.querySelector("[data-print-viewport]")!;
      const clip = canvas.getBoundingClientRect(), box = paper.getBoundingClientRect();
      useIPC("application").application.inspectElement(
        Math.round((Math.max(clip.left, box.left) + Math.min(clip.right, box.right)) / 2),
        Math.round((Math.max(clip.top, box.top) + Math.min(clip.bottom, box.bottom)) / 2),
      );
    } catch (error) { failed(error); }
  };

  return (
    <div className="editor-pdf-debug" data-editor-pdf-debug-controls data-debug-fingerprint={snapshot.fingerprint}>
      <style>{styles}</style>
      <header className="debug-toolbar">
        <div className="debug-title">
          <Bug size={18} />
          <div><h1>Debug HTML</h1><p>{snapshot.pages} halaman · snapshot tetap</p></div>
        </div>
        <div className="debug-toolbar-actions">
          <Button type="button" variant="outline" data-debug-inspect onClick={inspectPage}>
            <MousePointer2 size={16} /> Inspect halaman
          </Button>
          {busy && <Button type="button" variant="outline" data-debug-cancel onClick={cancel}><X size={16} /> Batal</Button>}
          <Button type="button" data-debug-export disabled={busy} onClick={() => void exportSnapshot()}>
            {busy ? <Loader2 className="debug-spinner" size={16} /> : <FileDown size={16} />}
            {busy ? "Mengekspor…" : "Ekspor PDF"}
          </Button>
        </div>
      </header>
      <aside className="debug-sidebar" aria-label="Navigasi dan informasi snapshot">
        <form className="debug-page-navigation" onSubmit={event => { event.preventDefault(); jumpToPage(); }}>
          <label htmlFor="debug-page">Halaman fisik</label>
          <div>
            <Button type="button" variant="outline" data-debug-previous aria-label="Halaman sebelumnya" disabled={page === 0} onClick={() => selectPage(page - 1)}><ChevronLeft size={16} /></Button>
            <Input id="debug-page" data-debug-page type="number" min={1} max={snapshot.pages} value={pageInput} aria-label="Nomor halaman fisik"
              onChange={event => setPageInput(event.target.value)} onBlur={jumpToPage} />
            <span>dari {snapshot.pages}</span>
            <Button type="button" variant="outline" data-debug-next aria-label="Halaman berikutnya" disabled={page + 1 === snapshot.pages} onClick={() => selectPage(page + 1)}><ChevronRight size={16} /></Button>
          </div>
        </form>
        <dl className="debug-page-info" aria-live="polite">
          <div><dt>Bagian</dt><dd>{section?.title ?? snapshot.title}</dd></div>
          <div><dt>Nomor tercetak</dt><dd>{section?.labels[page + 1 - section.firstPage] || "Tanpa nomor"}</dd></div>
          <div><dt>Halaman bagian</dt><dd>{view.page} · context {view.context}</dd></div>
        </dl>
        <nav className="debug-sections" aria-label="Bagian dokumen">
          <h2>Bagian dokumen</h2>
          <ul>{sections.map(item => <li key={item.id}>
            <Button type="button" variant="ghost" data-debug-section={item.id} aria-current={item.id === section?.id ? "page" : undefined}
              title={item.title}
              onClick={() => selectPage(item.firstPage - 1)}>
              <span>{item.title}</span><span>{item.firstPage}</span>
            </Button>
          </li>)}</ul>
        </nav>
        {saved && <div role="status" className="debug-notice">
          <span>Tersimpan: {saved.filename}</span>
          <Button type="button" variant="outline" onClick={() => void useIPC("file").file.openPath(saved.path).catch(failed)}>Buka PDF</Button>
        </div>}
        {error && <div role="alert" className="debug-error"><p>{error.detail}</p>{error.report?.action}</div>}
        <Collapsible className="debug-identity">
          <CollapsibleTrigger asChild><Button type="button" variant="ghost">Identitas snapshot <ChevronDown size={14} /></Button></CollapsibleTrigger>
          <CollapsibleContent><code>{snapshot.documentId}</code><code>{snapshot.fingerprint}</code></CollapsibleContent>
        </Collapsible>
        <p className="debug-help">Klik kanan pada halaman untuk Inspect Element. F12 atau Cmd+Alt+I / Ctrl+Shift+I membuka DevTools. Ekspor memakai snapshot ini, termasuk setelah editor berubah.</p>
      </aside>
    </div>
  );
}
