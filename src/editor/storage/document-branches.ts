import { HighTexDB } from "./hightex-db";
import { Manager } from "@/editor/manager";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";
import { Exporter } from "@/utils/htx/exporter";
import { archiveSha256, readImportModel } from "@/utils/htx/import-model";
import {
  captureDraft,
  installDraft,
  prepareDraftImport,
} from "@/utils/htx/draft-transfer";

export async function listDocumentBranches(
  documentId: string,
): Promise<HighTexDocument[]> {
  const db = HighTexDB.getInstance();
  const current = await db.documents.get(documentId);
  if (!current) {
    throw new ShouldNotified({
      message: t("editor.branches.source_missing"),
      description: t("editor.branches.source_missing_description"),
    });
  }
  const root = current.parentId
    ? await db.documents.get(current.parentId)
    : current;
  if (!root) {
    throw new ShouldNotified({
      message: t("editor.branches.source_missing"),
      description: t("editor.branches.source_missing_description"),
    });
  }
  const branches = await db.documents
    .where("parentId")
    .equals(root.id)
    .toArray();
  return [
    root,
    ...branches.sort((a, b) =>
      (a.branchName ?? a.title).localeCompare(b.branchName ?? b.title, "en", {
        sensitivity: "base",
      }),
    ),
  ];
}

export async function createDocumentBranch(
  sourceDocumentId: string,
  branchName: string,
): Promise<HighTexDocument> {
  const name = branchName.trim();
  if (!name) {
    throw new ShouldNotified({
      message: t("editor.branches.name_required"),
      description: t("editor.branches.name_required_description"),
    });
  }
  if (name.length > 64) {
    throw new ShouldNotified({
      message: t("editor.branches.name_too_long"),
      description: t("editor.branches.name_too_long_description"),
    });
  }

  const db = HighTexDB.getInstance();
  const source = await db.documents.get(sourceDocumentId);
  if (!source) {
    throw new ShouldNotified({
      message: t("editor.branches.source_missing"),
      description: t("editor.branches.source_missing_description"),
    });
  }

  const rootId = source.parentId || source.id;
  if (source.parentId) {
    throw new ShouldNotified({
      message: t("editor.branches.fork_from_main"),
      description: t("editor.branches.fork_from_main_description"),
    });
  }
  const siblings = await db.documents
    .where("parentId")
    .equals(rootId)
    .toArray();
  if (
    siblings.some(
      (document) =>
        document.branchName?.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
  )
    throw new ShouldNotified({
      message: t("editor.branches.name_exists", { name }),
      description: t("editor.branches.name_exists_description"),
    });

  const { buffer } = await new Exporter(sourceDocumentId).buildExport();
  const parentRevision = await archiveSha256(buffer);
  const model = readImportModel(buffer);
  const id = crypto.randomUUID();
  const before = await captureDraft(db, id);
  const categories = await window.hightex.categories();
  const prepared = await prepareDraftImport(
    model,
    id,
    categories,
    `branch_${id}_`,
  );
  prepared.state.document.parentId = rootId;
  prepared.state.document.branchName = name;
  prepared.state.document.parentRevision = parentRevision;
  delete prepared.state.document.file;
  delete prepared.state.document.cloudAcademic;
  await installDraft(db, prepared, before);
  Manager.app.dispatch("document:updated", {
    document: prepared.state.document,
  });
  return prepared.state.document;
}

export async function mergeDocumentBranch(branchId: string) {
  const db = HighTexDB.getInstance();
  const branch = await db.documents.get(branchId);
  if (!branch?.parentId || !branch.parentRevision) {
    throw new ShouldNotified({
      message: t("editor.branches.merge_unavailable"),
      description: t("editor.branches.merge_unavailable_description"),
    });
  }
  const main = await db.documents.get(branch.parentId);
  if (!main) {
    throw new ShouldNotified({
      message: t("editor.branches.source_missing"),
      description: t("editor.branches.source_missing_description"),
    });
  }
  if ("editor" in window && (await window.editor.has(main.id))) {
    throw new ShouldNotified({
      message: t("editor.branches.close_main"),
      description: t("editor.branches.close_main_description"),
    });
  }

  const { buffer } = await new Exporter(main.id).buildExport();
  if ((await archiveSha256(buffer)) !== branch.parentRevision) {
    throw new ShouldNotified({
      message: t("editor.branches.merge_conflict"),
      description: t("editor.branches.merge_conflict_description"),
    });
  }

  const branchArchive = await new Exporter(branch.id).buildExport();
  const model = readImportModel(branchArchive.buffer);
  const before = await captureDraft(db, main.id);
  const categories = await window.hightex.categories();
  const prepared = await prepareDraftImport(
    model,
    main.id,
    categories,
    `merge_${main.id}_${crypto.randomUUID()}_`,
  );
  prepared.state.document.parentId = null;
  prepared.state.document.branchName = undefined;
  prepared.state.document.parentRevision = undefined;
  prepared.state.document.file = main.file;
  prepared.state.document.cloudAcademic = main.cloudAcademic;
  await installDraft(db, prepared, before);

  const mergedArchive = await new Exporter(main.id).buildExport();
  await db.documents.update(branch.id, {
    parentRevision: await archiveSha256(mergedArchive.buffer),
  });
  Manager.app.dispatch("document:updated", {
    document: prepared.state.document,
  });
  return prepared.state.document;
}
