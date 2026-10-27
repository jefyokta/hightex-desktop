import { Outlet, useParams } from "react-router-dom";
import { useCallback } from "react";
import { PrintableProvider } from "@/hooks/use-printable";
import { CliDocumentsSlave } from "@/slaves/cli-documents";
import { PrintStyles } from "@/components/submission/print-styles";
import { reportPrintError } from "@/utils/print-request";

export const PrintLayout = () => {
  const { id, chapterId } = useParams();
  const onError = useCallback(
    (error: unknown) => {
      const documentId = id ?? chapterId?.split(".")[0];
      if (documentId) reportPrintError(documentId, error);
    },
    [id, chapterId],
  );

  return (
    <PrintStyles onError={onError}>
      <PrintableProvider refreshAcademic>
        <CliDocumentsSlave />
        <Outlet />
      </PrintableProvider>
    </PrintStyles>
  );
};
