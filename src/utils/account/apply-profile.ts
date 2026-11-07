import type { HighTexDB } from "@/editor/storage/hightex-db";
import { emptyAuthorProfile } from "@/utils/document-profile";
export type AccountField = "name" | "nim" | "cv" | "picture";
export const accountProfilePatch = (
  data: AccountProfileData,
  fields: AccountField[],
  picture?: Blob,
): Partial<AuthorProfile> => {
  const patch: Partial<AuthorProfile> = {};
  if (fields.includes("name")) patch.name = data.name;
  if (fields.includes("nim") && data.nim !== null) patch.nim = data.nim;
  if (fields.includes("cv") && data.cv !== null) patch.cv = data.cv;
  if (fields.includes("picture") && picture) patch.picture = picture;
  return patch;
};
export const applyAccountProfile = async (
  db: HighTexDB,
  before: HighTexDocument,
  patch: Partial<AuthorProfile>,
  guard: {
    current(): Promise<void>;
    isCurrent?(): boolean;
    locked(id: string): Promise<boolean>;
    editor(id: string): Promise<boolean>;
  },
) => {
  await guard.current();
  if (await guard.locked(before.id)) throw Error("cloud_locked");
  if (await guard.editor(before.id)) throw Error("editor_open");
  await guard.current();
  await db.transaction("rw", db.documents, async () => {
    const current = await db.documents.get(before.id);
    if (guard.isCurrent && !guard.isCurrent()) throw Error("session_changed");
    if (
      !current ||
      current.cloudAcademic ||
      JSON.stringify({ ...current.profile, picture: undefined }) !==
        JSON.stringify({ ...before.profile, picture: undefined }) ||
      String(current.updatedAt) !== String(before.updatedAt)
    )
      throw Error("document_changed");
    await db.documents.put({
      ...current,
      profile: { ...emptyAuthorProfile(), ...current.profile, ...patch },
      updatedAt: new Date(),
    });
  });
};
