import { PreviewCardPanel } from "@/components/animate-ui/components/base/preview-card";
import {
  PreviewCard,
  PreviewCardTrigger,
} from "@/components/animate-ui/primitives/base/preview-card";
import { TextRenderer } from "@/components/editor/text-renderer";

import { Document } from "@/editor/document";
import { Manager } from "@/editor/manager";

import { NodeNotFound } from "@/exception/node-not-found";

import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";

import { useEffect, useState } from "react";

export const RefComponent: React.FC<NodeViewProps> = ({ node }) => {
  const type = node.attrs.type || "imageFigure";

  const reference = node.attrs.link;

  return (
    <NodeViewWrapper
      className="
                ref-component
                inline
                hover:bg-blue-200
                rounded-sm
                cursor-pointer
            "
      data-link={node.attrs.link}
      data-ref={reference}
      data-type="ref-component"
    >
      {type === "imageFigure" ? (
        <ImageRef reference={reference} />
      ) : (
        <TableRef reference={reference} />
      )}
    </NodeViewWrapper>
  );
};

type RefProps = {
  reference?: string;
};
const ImageRef = ({ reference }: RefProps) => {
  const [image, setImage] = useState<ImageGraph>();

  useEffect(() => {
    const resolveImage = async (doc: Document) => {
      const img = (await doc.getImages()).find((i) => {
        console.log(i)
        return i.id === reference});

      if (!img) {
        throw new NodeNotFound("Missing Image Figure!", "Image Figure");
      }

      setImage(img);
    };

    const doc = Document.instance;
    if (doc?.ready) {
      resolveImage(doc);
    }

    const off = Manager.app.on("document:warmed", async ({ document }) => {
      await resolveImage(document);
    });
    const offChapter = Manager.app.on("chapter:update", async () => {
      await resolveImage(Document.instance!)

    })

    return () => { off(); offChapter() };
  }, [reference]);

  return (
    <PreviewCard>
      <PreviewCardTrigger
        render={
          <a
            data-ref={reference}
            onClick={() => {
              document.getElementById(reference || "")?.scrollIntoView({ behavior: "smooth" })
            }}
            data-href={
              image
                ? `/document/${image.chapterId.replace(".", "/")}?target=${reference}`
                : ""
            }
          >
            {image ? `Gambar ${image.numbering}` : "Loading"}


          </a>
        }
      />

      <PreviewCardPanel>
        <div className="flex flex-col gap-2">
          <img src={image?.imgSrc} className="aspect-auto rounded-2xl" />
          <div className="text-xs text-center">
            <span>{`Gambar ${image?.numbering} `}</span>
            <TextRenderer texts={image?.text ?? []} />
          </div>
        </div>
      </PreviewCardPanel>
    </PreviewCard>
  );
};
const TableRef = ({ reference }: RefProps) => {
  return <span data-ref={reference}>Table Ref</span>;
};
