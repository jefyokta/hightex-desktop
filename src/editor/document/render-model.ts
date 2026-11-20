import type {
  DocumentAsset,
  DocumentRenderModel,
  DocumentSnapshot,
} from "@/types/document-snapshot";
import { contentFingerprint } from "@/utils/htx/content-fingerprint";
import { archiveSha256 } from "@/utils/htx/import-model";

const binaryAsset = async (blob: Blob): Promise<DocumentAsset> => ({
  bytes: new Uint8Array(await blob.arrayBuffer()),
  mime: blob.type || "image/webp",
});

/** Adapt stored records without generating an archive or creating resource URLs. */
export async function documentRenderModel(
  snapshot: DocumentSnapshot,
): Promise<DocumentRenderModel> {
  const { document, chapters, cites, aliases, variables, images } = snapshot;
  const profile = document.profile ? { ...document.profile } : undefined;
  const picture = profile?.picture;
  if (profile) delete profile.picture;
  return {
    document: {
      id: document.id,
      title: document.title,
      altTitle: document.altTitle,
      category: document.category,
      keywords: document.keywords,
    },
    chapters: chapters.map((chapter) => ({
      id: chapter.id.slice(document.id.length + 1),
      content: chapter.content,
    })),
    // Preserve the portable representation of config dates used by fingerprints.
    config: JSON.parse(JSON.stringify(document.config)),
    references: Object.fromEntries(cites.map(({ key, bib }) => [key, bib])),
    aliases: aliases.map(({ key, value }) => ({ key, value })),
    variables: variables.map(({ name, value }) => ({ name, value })),
    images: Object.fromEntries(
      await Promise.all(
        images.map(async ({ id, blob }) => [id, await binaryAsset(blob)]),
      ),
    ),
    profile,
    profilePicture: picture ? await binaryAsset(picture) : undefined,
  };
}

/** Identify all rendered inputs, including title, author and photograph. */
export async function documentRenderFingerprint(model: DocumentRenderModel) {
  const content = await contentFingerprint(model);
  const picture = model.profilePicture
    ? {
        mime: model.profilePicture.mime,
        hash: await archiveSha256(model.profilePicture.bytes),
      }
    : undefined;
  const images = Object.entries(model.images)
    .map(([id, asset]) => [id, asset.mime])
    .sort(([left], [right]) => left.localeCompare(right));
  return archiveSha256(
    new TextEncoder().encode(
      JSON.stringify({
        content,
        document: model.document,
        profile: model.profile,
        picture,
        images,
      }),
    ),
  );
}
