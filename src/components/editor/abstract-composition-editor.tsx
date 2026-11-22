import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import { liveQuery } from "dexie";
import type { Chapter } from "@/editor/chapter/chapter";
import { Storage } from "@/editor/storage";
import { SectionComposition } from "@/document-engine/composition/section-composition";
import { abstractCompositionDefinition } from "@/document-engine/adapters/abstract-composition";
import {
  invalidateWorkspaceAuthorProfile,
  resolveWorkspaceDocumentProfile,
} from "@/utils/document-profile";
import type { SectionCompositionDefinition } from "../../../shared/section-layout";
import { sameSectionComposition } from "../../../shared/section-layout";
import "@/css/document-template.css";
import { KeywordEditor } from "./keyword-editor";
import { t } from "@/utils/lang";
import { useAppLanguage } from "@/hooks/use-app-language";

/** Mount only generated presentation around the existing EditorContent; never replace its state. */
export function AbstractCompositionEditor({
  chapter,
  editor,
  enabled,
  children,
}: {
  chapter: Chapter;
  editor: Editor | null;
  enabled: boolean;
  children: ReactNode;
}) {
  useAppLanguage();
  const host = useRef<HTMLDivElement>(null),
    body = useRef<HTMLDivElement>(null);
  const [definition, setDefinition] = useState<SectionCompositionDefinition>();
  const [error, setError] = useState("");
  const [keywordAnchor, setKeywordAnchor] = useState<HTMLElement>();
  useEffect(() => {
    setDefinition(undefined);
    setError("");
    if (!enabled || !editor) return;
    const key = chapter.getChapter();
    if (key !== "abstract" && key !== "abstract-en") return;
    let alive = true,
      generation = 0;
    const refresh = async (input?: HighTexDocument) => {
      const current = ++generation;
      try {
        const data =
          input ??
          (await Storage.instance.getDocument(chapter.getDocumentId()));
        if (!data || !chapter.document.category)
          throw Error("Abstract source is unavailable");
        const profile = await resolveWorkspaceDocumentProfile(data);
        if (!alive || current !== generation || editor.isDestroyed) return;
        const source = editor.state.doc.firstChild;
        const next = abstractCompositionDefinition(
          { ...data, profile },
          chapter.document.category,
          key,
          source?.type.name === "heading" && source.attrs.level === 1,
        );
        setDefinition((previous) =>
          sameSectionComposition(previous, next) ? previous : next,
        );
        setError("");
      } catch (cause) {
        if (alive && current === generation)
          setError(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const subscription = liveQuery(() =>
      Storage.instance.getDocument(chapter.getDocumentId()),
    ).subscribe({
      next: (data) => {
        void refresh(data);
      },
      error: (cause) => {
        if (alive) setError(String(cause));
      },
    });
    const identityChanged = () => {
      invalidateWorkspaceAuthorProfile();
      void refresh();
    };
    const offProfile = window.profile?.onChange?.(identityChanged),
      offSession = window.session?.onChange?.(identityChanged);
    return () => {
      alive = false;
      generation++;
      subscription.unsubscribe();
      offProfile?.();
      offSession?.();
    };
  }, [chapter, editor, enabled]);

  useLayoutEffect(() => {
    if (!host.current || !body.current || !editor || editor.isDestroyed) return;
    let shell: SectionComposition | undefined;
    try {
      if (enabled && definition && !error) {
        shell = new SectionComposition(document, definition);
        shell.body.append(body.current);
        host.current.append(shell.element);
        const keywords = shell.element.querySelector<HTMLElement>("[data-abstract-keywords]");
        if (keywords && !chapter.frozen) {
          keywords.classList.add("abstract-keyword-trigger");
          keywords.setAttribute("role", "button");
          keywords.setAttribute("tabindex", "0");
          keywords.setAttribute("aria-label", t("editor.keywords.edit"));
          keywords.title = t("editor.keywords.edit");
          keywords.onclick = () => setKeywordAnchor(keywords);
          keywords.onkeydown = event => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setKeywordAnchor(keywords); }
          };
        }
      }
      editor.view.dom.dispatchEvent(new Event("section-composition-change"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
    return () => {
      if (host.current && body.current) host.current.prepend(body.current);
      shell?.element.remove();
      setKeywordAnchor(undefined);
    };
  }, [definition, enabled, editor, error]);

  return (
    <div
      ref={host}
      data-section-composition-pending={
        enabled && !definition && !error ? "true" : undefined
      }
      data-section-composition-error={error || undefined}
    >
      {error && (
        <p role="alert" data-editor-ui>
          {error}
        </p>
      )}
      <div ref={body}>{children}</div>
      {keywordAnchor && <KeywordEditor documentId={chapter.getDocumentId()}
        language={chapter.getChapter() === "abstract-en" ? "english" : "indonesian"}
        anchor={keywordAnchor} onClose={() => setKeywordAnchor(undefined)} />}
    </div>
  );
}
