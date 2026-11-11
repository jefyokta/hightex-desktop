import { useEffect, useState } from "react";
import { useMatch } from "react-router-dom";
import { liveQuery } from "dexie";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { t, useAppLanguage } from "@/utils/lang";
import { parseItalic } from "@/utils/parse-italic";

export const WindowTitleSlave = () => {
  useAppLanguage();
  const match = useMatch("/document/:id/:chapter?/:version?");
  const documentId = match?.params.id;
  const { state } = useWorkspaces();
  const [record, setRecord] = useState<HighTexDocument>();

  useEffect(() => {
    if (!documentId) return;
    const subscription = liveQuery(() =>
      HighTexDB.getInstance().documents.get(documentId),
    ).subscribe({ next: setRecord, error: console.error });
    return () => subscription.unsubscribe();
  }, [documentId]);

  const activeDocument = record?.id === documentId ? record : undefined;
  const workspace = state?.profiles.find(
    (profile) => profile.id === state.activeId,
  );
  const name = documentId
    ? parseItalic(activeDocument?.title ?? "")
        .map((part) => part.text)
        .join("")
        .replace(/\s+/g, " ")
        .trim() || t("common.untitled_document")
    : workspace?.name.trim();
  const branch = activeDocument?.parentId
    ? activeDocument.branchName?.trim()
    : undefined;
  const title = [name, branch, "HighTex"].filter(Boolean).join(" — ");

  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "HighTex";
    };
  }, [title]);

  return null;
};
