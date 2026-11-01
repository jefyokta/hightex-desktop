import { PreviewCardPanel } from "@/components/animate-ui/components/base/preview-card";
import {
  PreviewCard,
  PreviewCardTrigger,
} from "@/components/animate-ui/primitives/base/preview-card";
import { TextRenderer } from "@/components/editor/text-renderer";
import { Button } from "@/components/ui/button";
import { Katex } from "@/editor/components/katex";

import { Document } from "@/editor/document";
import { Manager } from "@/editor/manager";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { ShouldNotified } from "@/exception/interfaces/should-notified";

import { useParams } from "@/hooks/use-params";
import { cn } from "@/lib/utils";
import { t, useAppLanguage } from "@/utils/lang";
import { truncate } from "@/utils/truncate";

import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { Counter } from "tjsn-parser";

type RefProps = {
  reference: string;
  locate: () => void;
};

type RefStatus = "loading" | "ready" | "missing" | "error";

type RefState<T> =
  | { status: "loading" }
  | { status: "ready"; item: T }
  | { status: "missing" }
  | { status: "error" };

type RefKind = "head" | "imageFigure" | "figureTable" | "equation";

const REF_LABEL_KEYS = {
  head: "node.reference.appendix",
  imageFigure: "node.reference.figure",
  figureTable: "node.reference.table",
  equation: "node.reference.equation",
} as const;

const refName = (kind: RefKind) => t(REF_LABEL_KEYS[kind]);

const REF_ERROR_NAME_KEYS = {
  head: "node.reference.error_names.appendix",
  imageFigure: "node.reference.error_names.figure",
  figureTable: "node.reference.error_names.table",
  equation: "node.reference.error_names.equation",
} as const;

const refErrorName = (kind: RefKind) => t(REF_ERROR_NAME_KEYS[kind]);

const chapterPath = (chapterId: string) => chapterId.replace(".", "/");

const refHref = (chapterId: string, reference: string) =>
  `/document/${chapterPath(chapterId)}?target=${encodeURIComponent(reference)}`;

const isBroken = (status: RefStatus) =>
  status === "missing" || status === "error";

const refLabel = (
  kind: RefKind,
  status: RefStatus,
  numbering?: string | number,
) => {
  if (status === "loading") return t("node.reference.loading");
  return t("node.reference.label", {
    node: refName(kind),
    number: isBroken(status) ? "?" : (numbering ?? ""),
  }).trim();
};

const missingRefError = (
  kind: RefKind,
  reference: string,
  locate: () => void,
) =>
  new ShouldNotified({
    message: t("node.reference.not_found", { node: refErrorName(kind) }),
    action: <Button onClick={locate}>{t("node.reference.locate")}</Button>,
    description: t("node.reference.missing_description", {
      node: refErrorName(kind),
      reference: truncate(reference, 10),
    }),
  });

const reportRefError = (error: unknown) => {
  void Promise.reject(error);
};

function useDocItem<T>(
  key: string,
  find: (doc: Document) => Promise<T | undefined>,
  makeMissingError: () => unknown,
): { item: T | undefined; status: RefStatus } {
  const [state, setState] = useState<RefState<T>>({ status: "loading" });

  const findRef = useRef(find);
  const makeErrorRef = useRef(makeMissingError);
  findRef.current = find;
  makeErrorRef.current = makeMissingError;

  useEffect(() => {
    let alive = true;
    let run = 0;
    let reported = false;

    setState((prev) =>
      prev.status === "loading" ? prev : { status: "loading" },
    );

    const resolve = async (doc: Document) => {
      const id = ++run;
      try {
        const item = await findRef.current(doc);
        if (!alive || id !== run) return;

        if (item === undefined) {
          setState({ status: "missing" });
          if (!reported) {
            reported = true;
            reportRefError(makeErrorRef.current());
          }
          return;
        }

        reported = false;
        setState({ status: "ready", item });
      } catch (error) {
        if (!alive || id !== run) return;
        console.error(error);
        setState({ status: "error" });
      }
    };

    const current = Document.instance;
    if (current?.ready) void resolve(current);

    const offWarmed = Manager.app.on("document:warmed", ({ document }) => {
      void resolve(document);
    });

    const offChapter = Manager.app.on("chapter:update", () => {
      const doc = Document.instance;
      if (doc) void resolve(doc);
    });

    return () => {
      alive = false;
      offWarmed();
      offChapter();
    };
  }, [key]);

  return {
    item: state.status === "ready" ? state.item : undefined,
    status: state.status,
  };
}

function useOpenRef(reference: string, chapterId: string | undefined) {
  const nav = useNavigate();
  const { setParams } = useParams();

  return useCallback(() => {
    if (!chapterId) return;

    if (chapterId === Document.current?.getId()) {
      Manager.scrollTo(reference);
      return;
    }

    setParams([reference]);
    nav(refHref(chapterId, reference));
  }, [chapterId, reference, nav, setParams]);
}

function useImageSrc(imgSrc: string | undefined) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    if (!imgSrc) {
      setSrc(undefined);
      return;
    }

    if (imgSrc.startsWith("data:")) {
      setSrc(imgSrc);
      return;
    }

    let alive = true;
    let created: string | undefined;

    setSrc(undefined);

    HighTexDB.getInstance()
      .getBlobUrl(imgSrc)
      .then((url) => {
        if (!url) return;

        if (!alive) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
          return;
        }

        created = url;
        setSrc(url);
      })
      .catch((err) => console.error(err));

    return () => {
      alive = false;
      if (created?.startsWith("blob:")) URL.revokeObjectURL(created);
    };
  }, [imgSrc]);

  return src;
}

function refLinkProps(
  reference: string,
  chapterId: string | undefined,
  status: RefStatus,
  open: () => void,
) {
  return {
    role: "link",
    tabIndex: 0,
    "data-ref": reference,
    "data-href": chapterId ? refHref(chapterId, reference) : "",
    "data-status": status,
    className: cn(isBroken(status) && "text-destructive"),
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      open();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      open();
    },
  };
}

type RefPreviewProps = {
  link: ReturnType<typeof refLinkProps>;
  label: string;
  status: RefStatus;
  kind: RefKind;
  children: ReactNode;
};

const RefPreview: FC<RefPreviewProps> = ({
  link,
  label,
  status,
  kind,
  children,
}) => (
  <PreviewCard>
    <PreviewCardTrigger render={<a {...link}>{label}</a>} />

    <PreviewCardPanel>
      {status === "ready" ? (
        children
      ) : (
        <span className="text-xs">
          {status === "loading"
            ? t("node.reference.loading")
            : status === "error"
              ? t("node.reference.load_failed", { node: refErrorName(kind) })
              : t("node.reference.not_found", { node: refErrorName(kind) })}
        </span>
      )}
    </PreviewCardPanel>
  </PreviewCard>
);

const HeadRef: FC<RefProps> = ({ reference, locate }) => {
  const { item: head, status } = useDocItem<HeadingGraph>(
    reference,
    async (doc) =>
      (await doc.getHeadings()).find(
        (h) =>
          h.chapterId === `${doc.id}.attachment` &&
          h.level === 1 &&
          String(h.id) === reference,
      ),
    () => missingRefError("head", reference, locate),
  );

  const open = useOpenRef(reference, head?.chapterId);

  const label = refLabel(
    "head",
    status,
    head ? Counter.getAlpha(Number(head.numbering ?? 0)) : undefined,
  );

  return (
    <a {...refLinkProps(reference, head?.chapterId, status, open)}>{label}</a>
  );
};

const ImageRef: FC<RefProps> = ({ reference, locate }) => {
  const { item: image, status } = useDocItem<ImageGraph>(
    reference,
    async (doc) => (await doc.getImages()).find((i) => i.id === reference),
    () => missingRefError("imageFigure", reference, locate),
  );

  const open = useOpenRef(reference, image?.chapterId);
  const src = useImageSrc(image?.imgSrc);

  return (
    <RefPreview
      link={refLinkProps(reference, image?.chapterId, status, open)}
      label={refLabel("imageFigure", status, image?.numbering)}
      status={status}
      kind="imageFigure"
    >
      <div className="flex flex-col gap-2">
        {src && (
          <img
            src={src}
            alt={refLabel("imageFigure", status, image?.numbering)}
            className="aspect-auto rounded-2xl"
            loading="lazy"
          />
        )}

        <div className="text-xs text-center">
          <span>{refLabel("imageFigure", status, image?.numbering)} </span>
          <TextRenderer texts={image?.text ?? []} />
        </div>
      </div>
    </RefPreview>
  );
};

const EquationRef: FC<RefProps> = ({ reference, locate }) => {
  const { item: equation, status } = useDocItem<EquationGraph>(
    reference,
    async (doc) => (await doc.getEquations()).find((e) => e.id === reference),
    () => missingRefError("equation", reference, locate),
  );

  const open = useOpenRef(reference, equation?.chapterId);

  return (
    <RefPreview
      link={refLinkProps(reference, equation?.chapterId, status, open)}
      label={refLabel("equation", status, equation?.numbering)}
      status={status}
      kind="equation"
    >
      <div className="flex flex-col gap-2">
        <div className="text-xs text-center">
          <span>{refLabel("equation", status, equation?.numbering)} </span>

          <div className="rounded border my-2">
            <Katex latex={equation?.latex} />
          </div>
        </div>
      </div>
    </RefPreview>
  );
};

const TableRef: FC<RefProps> = ({ reference, locate }) => {
  const { item: table, status } = useDocItem<TableGraph>(
    reference,
    async (doc) => (await doc.getTables()).find((t) => t.id === reference),
    () => missingRefError("figureTable", reference, locate),
  );

  const open = useOpenRef(reference, table?.chapterId);

  return (
    <RefPreview
      link={refLinkProps(reference, table?.chapterId, status, open)}
      label={refLabel("figureTable", status, table?.numbering)}
      status={status}
      kind="figureTable"
    >
      <div className="text-xs text-center">
        <span>{refLabel("figureTable", status, table?.numbering)} </span>
        <TextRenderer texts={table?.text ?? []} />
      </div>
    </RefPreview>
  );
};

const REF_COMPONENTS: Partial<Record<string, FC<RefProps>>> = {
  head: HeadRef,
  imageFigure: ImageRef,
  figureTable: TableRef,
  equation: EquationRef,
};

export const RefComponent: FC<NodeViewProps> = ({ node, editor, getPos }) => {
  useAppLanguage();
  const type: string = node.attrs.ref || "imageFigure";
  const reference: string | undefined = node.attrs.link;

  const Component = REF_COMPONENTS[type];
  const locate = useCallback(() => {
    const pos = getPos();
    if (typeof pos !== "number") return;

    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setTextSelection(pos)
      .run();

    requestAnimationFrame(() => {
      const dom = editor.view.nodeDOM(pos);
      const el = dom instanceof HTMLElement ? dom : dom?.parentElement;
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [editor, getPos]);
  return (
    <NodeViewWrapper
      className={cn(
        "ref-component inline cursor-pointer rounded-sm hover:bg-blue-200 dark:hover:text-black",
        node.attrs.ref,
      )}
      data-link={node.attrs.link}
      data-ref={reference}
      data-type="ref-component"
    >
      {Component && reference ? (
        <Component reference={reference} locate={locate} />
      ) : (
        <span className="text-destructive">{t("node.reference.invalid")}</span>
      )}
    </NodeViewWrapper>
  );
};
