import { strFromU8, strToU8 } from "fflate";
import { normalizeAuthorProfile } from "../document-profile";

const PROFILE_PATH = "files/profile.json";
const PICTURE_PATH = "files/assets/profile.webp";

export const writeProfileEntries = async (profile: AuthorProfile) => {
  const { picture, ...data } = profile;
  const entries: Record<string, Uint8Array> = {
    [PROFILE_PATH]: strToU8(JSON.stringify(data)),
  };
  if (picture) {
    entries[PICTURE_PATH] = new Uint8Array(await picture.arrayBuffer());
  }
  return entries;
};

export const readProfileEntries = (
  entries: Record<string, Uint8Array>,
  legacyProfile?: Profile,
): AuthorProfile | undefined => {
  const entry = entries[PROFILE_PATH];
  const profile = normalizeAuthorProfile(
    entry ? JSON.parse(strFromU8(entry)) : legacyProfile,
  );
  if (profile && entries[PICTURE_PATH]) {
    profile.picture = new Blob([entries[PICTURE_PATH].slice().buffer], {
      type: "image/webp",
    });
  }
  return profile;
};
