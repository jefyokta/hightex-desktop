import { HighTexDB } from "./hightex-db";
import { Manager } from "@/editor/manager";
import { ShouldNotified } from "@/exception/interfaces/should-notified";
import { t } from "@/utils/lang";
import { Exporter } from "@/utils/htx/exporter";
import { archiveSha256, readImportModel } from "@/utils/htx/import-model";
import { contentFingerprint } from "@/utils/htx/content-fingerprint";
import { getWorkspaceAuthorProfile } from "@/utils/document-profile";
import { writeProfileEntries } from "@/utils/htx/profile";
import { zipSync } from "fflate";
import {
  captureDraft,
  installDraft,
  prepareDraftImport,
} from "@/utils/htx/draft-transfer";

const REVISION_PREFIX = "document-v1:";
const documentRevision = async (buffer: Uint8Array) => {
  const model = readImportModel(buffer);
  const workspace = await getWorkspaceAuthorProfile();
  const { title, altTitle, category, keywords } = model.document;
  // Workspace identity changes apply to both versions. Cloud academic
  // assignments remain document data and must still participate in conflicts.
  const profile = model.profile;
  const revision = {
    title,
    altTitle,
    category,
    keywords,
    content: await contentFingerprint(model),
    academic: workspace.isCloud
      ? {
          advisorName: profile?.advisorName,
          advisorNip: profile?.advisorNip,
          secondAdvisor: profile?.secondAdvisor,
          committee: profile?.committee,
        }
      : undefined,
  };
  return (
    REVISION_PREFIX +
    (await archiveSha256(new TextEncoder().encode(JSON.stringify(revision))))
  );
};

const matchesLegacyRevision = async (
  archive: Awaited<ReturnType<Exporter["buildExport"]>>,
  branch: HighTexDocument,
) => {
  if ((await archiveSha256(archive.buffer)) === branch.parentRevision)
    return true;
  if (!branch.profile) return false;
  const workspace = await getWorkspaceAuthorProfile();
  const profile = workspace.isCloud
    ? {
        ...archive.document.profile!,
        name: branch.profile.name,
        nim: branch.profile.nim,
        cv: branch.profile.cv,
        picture: branch.profile.picture,
      }
    : branch.profile;
  // Older branches retain their original author snapshot. Reconstruct only
  // identity entries and still require the complete archive to match its hash.
  const entries = { ...archive.entries };
  delete entries["files/profile.json"];
  delete entries["files/assets/profile.webp"];
  Object.assign(entries, await writeProfileEntries(profile));
  const buffer = zipSync(
    Object.fromEntries(
      Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
    ),
    { level: 9, mtime: new Date(1980, 0, 1) },
  );
  return (await archiveSha256(buffer)) === branch.parentRevision;
};

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
  const parentRevision = await documentRevision(buffer);
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
  prepared.state.document.authorProfileMode = "workspace";
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

  const mainArchive = await new Exporter(main.id).buildExport();
  const matches = branch.parentRevision.startsWith(REVISION_PREFIX)
    ? (await documentRevision(mainArchive.buffer)) === branch.parentRevision
    : await matchesLegacyRevision(mainArchive, branch);
  if (!matches) {
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
    parentRevision: await documentRevision(mergedArchive.buffer),
  });
  Manager.app.dispatch("document:updated", {
    document: prepared.state.document,
  });
  return prepared.state.document;
}
