import type { DocumentSnapshot } from "@/types/document-snapshot";
import { HighTexDB } from "./hightex-db";
import { HighTexExportError } from "@/exception/hightex-export";
import { previewDocumentDraft } from "../document-drafts";
import { contentAssets } from "@/utils/content-assets";
import { applyCloudAcademic } from "@/utils/cloud-academic";
import { migrateDocumentCommittee } from "@/utils/document-committee";
import {
  getWorkspaceAuthorProfile,
  resolveAuthorProfile,
} from "@/utils/document-profile";
import { isStaticVar } from "@/utils/is-static-var";
import { t } from "@/utils/lang";

/** Read metadata, chapters and assets from a single committed database revision. */
export async function readDocumentSnapshot(
  documentId: string,
  options: { academic?: CloudAcademicData; draft?: HighTexDocument } = {},
  db = HighTexDB.getInstance(),
): Promise<DocumentSnapshot> {
  const workspaceProfile = await getWorkspaceAuthorProfile();
  return db.transaction(
    "r",
    [
      db.documents,
      db.chapters,
      db.cite,
      db.aliases,
      db.documentVariables,
      db.images,
    ],
    async () => {
      const current = await db.documents.get(documentId);
      if (!current)
        throw new HighTexExportError(
          t("error.htx.document_not_found_for_export"),
        );
      const document = previewDocumentDraft(current, options.draft);
      const chapters = await db.chapters
        .where("id")
        .startsWith(`${documentId}.`)
        .toArray();
      const assets = contentAssets(chapters);
      const resolved = {
        ...document,
        authorProfileMode: "workspace" as const,
        profile: resolveAuthorProfile(document, workspaceProfile),
      };
      return {
        document: migrateDocumentCommittee(
          options.academic
            ? applyCloudAcademic(resolved, options.academic)
            : resolved,
        ),
        chapters,
        cites: await db.cite
          .filter(
            (cite) =>
              !cite.documentId ||
              cite.documentId === documentId ||
              assets.references.has(cite.key),
          )
          .toArray(),
        aliases: await db.aliases
          .where("documentId")
          .equals(documentId)
          .toArray(),
        variables: await db.documentVariables
          .where("documentId")
          .equals(documentId)
          .filter((variable) => !isStaticVar(variable.name))
          .toArray(),
        images: await db.images
          .filter(
            (image) =>
              image.documentId === documentId || assets.images.has(image.id),
          )
          .toArray(),
      };
    },
  );
}
