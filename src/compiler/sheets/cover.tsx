import type { HTMLAttributes } from "react";
import { usePrintable } from "@/hooks/use-printable";
import { DocumentCover } from "@/components/printable/cover";

export const Cover = (props: HTMLAttributes<HTMLElement>) => {
  const { document, profile } = usePrintable();
  if (!document) return null;
  return (
    <DocumentCover
      document={document.getDocument()}
      profile={profile ?? undefined}
      variant={document.category?.variant}
      {...props}
    />
  );
};
