import { PreviewCardPanel } from "@/components/animate-ui/components/base/preview-card";
import {
  PreviewCard,
  PreviewCardTrigger,
} from "@/components/animate-ui/primitives/base/preview-card";
import { TextRenderer } from "@/components/editor/text-renderer";

import { Document } from "@/editor/document";
import { Manager } from "@/editor/manager";
import { HighTexDB } from "@/editor/storage/hightex-db";

import { NodeNotFound } from "@/exception/node-not-found";
import { useParams } from "@/hooks/use-params";

import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Counter } from "tjsn-parser";

export const RefComponent: React.FC<NodeViewProps> = ({ node }) => {
  const type = node.attrs.ref || "imageFigure";

  const reference = node.attrs.link;

  const nodeByType: Record<string, React.FC<RefProps>> = {
    "head": HeadRef,
    "imageFigure": ImageRef,
    "figureTable": TableRef
  } as const

  const Component = nodeByType[type as keyof typeof nodeByType]

  return (
    <NodeViewWrapper
      className="ref-component
                inline
                hover:bg-blue-200
                dark:hover:text-black
                rounded-sm
                cursor-pointer
            "
      data-link={node.attrs.link}
      data-ref={reference}
      data-type="ref-component"
    >
      <Component reference={reference}/>
    </NodeViewWrapper>
  );
};
type RefProps = {
  reference?: string;
};

const HeadRef = ({ reference }: RefProps) => {
  const [head, setHead] = useState<HeadingGraph>();
  const nav = useNavigate();
  const { setParams } = useParams();


  useEffect(() => {
    const resolveHead = async (doc: Document) => {
      const h = (await doc.getHeadings())
        .filter(
          (h) =>
            h.chapterId === Document.instance?.id + ".attachment" &&
            h.level === 1,
        )
        .find((h) => h.id == reference);
      if (!h)
        throw new NodeNotFound("missing referenced heading #" + reference);

      setHead(h);
    };
    const doc = Document.instance;
    if (doc && doc?.ready) {
      resolveHead(doc);
    }

    const off = Manager.app.on("document:warmed", async ({ document }) => {
      await resolveHead(document);
    });
    const offChapter = Manager.app.on("chapter:update", async () => {
      await resolveHead(Document.instance!);
    });

    return () => {
      off();
      offChapter();
    };
  });

  const num =
    typeof head?.numbering !== "undefined" ? Number(head.numbering) : 0;
  return <span onClick={(e) => {
    e.preventDefault();
    if (head?.chapterId == Document.current?.getId()) {
      Manager.scrollTo(reference!);
      return;
    }
    setParams([reference]);
    nav(`/document/${head?.chapterId.replace(".", "/")}`);
  }
  }
  >LAMPIRAN {Counter.getAlpha(num)}</span>;
};

const ImageRef = ({ reference }: RefProps) => {
  const [image, setImage] = useState<ImageGraph>();
  const [src, setSrc] = useState<string>();

  const nav = useNavigate();
  const { setParams } = useParams();

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null;

    const resolveImage = async (doc: Document) => {
      try {
        const img = (await doc.getImages()).find((i) => i.id === reference);

        if (!img) {
          throw new NodeNotFound("Missing Image Figure!", "Image Figure");
        }

        if (!mounted) return;

        setImage(img);

        if (!img.imgSrc) {
          setSrc(undefined);
          return;
        }

        if (img.imgSrc.startsWith("data:")) {
          setSrc(img.imgSrc);
          return;
        }

        const url = await HighTexDB.getInstance().getBlobUrl(img.imgSrc);

        if (!mounted) {
          if (url?.startsWith("blob:")) {
            URL.revokeObjectURL(url);
          }
          return;
        }

        objectUrl = url;

        setSrc(url ?? undefined);
      } catch (err) {
        console.error(err);
      }
    };

    const doc = Document.instance;

    if (doc?.ready) {
      void resolveImage(doc);
    }

    const offDocument = Manager.app.on("document:warmed", ({ document }) => {
      void resolveImage(document);
    });

    const offChapter = Manager.app.on("chapter:update", () => {
      if (Document.instance) {
        void resolveImage(Document.instance);
      }
    });

    return () => {
      mounted = false;

      offDocument();
      offChapter();

      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reference]);

  const href = image
    ? `/document/${image.chapterId.replace(".", "/")}?target=${reference}`
    : "";

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <a
            data-ref={reference}
            data-href={href}
            onClick={() => {
              if (!image) return;

              if (image.chapterId === Document.current?.getId()) {
                Manager.scrollTo(reference!);
                return;
              }

              setParams([reference]);

              nav(href);
            }}
          >
            {image ? `Gambar ${image.numbering}` : "Loading"}
          </a>
        }
      />

      <PreviewCardPanel>
        <div className="flex flex-col gap-2">
          {src && (
            <img
              src={src}
              alt={`Gambar ${image?.numbering}`}
              className="aspect-auto rounded-2xl"
              loading="lazy"
            />
          )}

          <div className="text-xs text-center">
            <span>{image ? `Gambar ${image.numbering} ` : ""}</span>

            <TextRenderer texts={image?.text ?? []} />
          </div>
        </div>
      </PreviewCardPanel>
    </PreviewCard>
  );
};
const TableRef = ({ reference }: RefProps) => {
  const [table, setTable] = useState<TableGraph>();
  const nav = useNavigate();
  const { setParams } = useParams();

  useEffect(() => {
    const resolveTable = async (doc: Document) => {
      const tab = (await doc.getTables()).find((i) => {
        return i.id === reference;
      });

      if (!tab) {
        throw new NodeNotFound("Missing Image Figure!", "Image Figure");
      }

      setTable(tab);
    };

    const doc = Document.instance;
    if (doc?.ready) {
      resolveTable(doc);
    }

    const off = Manager.app.on("document:warmed", async ({ document }) => {
      await resolveTable(document);
    });
    const offChapter = Manager.app.on("chapter:update", async () => {
      await resolveTable(Document.instance!);
    });

    return () => {
      off();
      offChapter();
    };
  }, [reference]);

  return (
    <PreviewCard>
      <PreviewCardTrigger
        onClick={(e) => {
          e.preventDefault();
          if (table?.chapterId == Document.current?.getId()) {
            Manager.scrollTo(reference!);
            return;
          }
          setParams([reference]);
          nav(`/document/${table?.chapterId.replace(".", "/")}`);
        }}
        render={<span>Tabel {table?.numbering}</span>}
      ></PreviewCardTrigger>
      <PreviewCardPanel>
        <div>
          <span>Table {table?.numbering} </span>
          <TextRenderer texts={table?.text || []}></TextRenderer>
        </div>
      </PreviewCardPanel>
    </PreviewCard>
  );
};
