import { readAuthorProfile } from "@hightex/importer";
import { documentCommittee } from "./document-committee";

export const emptyAuthorProfile = (): AuthorProfile => ({
  name: "",
  nim: "",
  advisorName: "",
  advisorNip: "",
  cv: "",
});

export const getAuthorDetails = (profile: Omit<Profile, "cv">) => ({
  name: profile.name,
  nim: profile.nim,
  advisorName: profile.advisorName,
  advisorNip: profile.advisorNip,
  secondAdvisor: profile.secondAdvisor,
  ...(profile.committee !== undefined ? { committee: profile.committee } : {}),
});

export const getProfileVariables = (profile?: AuthorProfile) => ({
  name: profile?.name ?? "",
  nim: profile?.nim ?? "",
  advisorName: profile?.advisorName ?? "",
  advisorNip: profile?.advisorNip ?? "",
  secondAdvisorName: profile?.secondAdvisor?.name ?? "",
  secondAdvisorNip: profile?.secondAdvisor?.nip ?? "",
});

export const isProfileVariable = (name: string) =>
  Object.prototype.hasOwnProperty.call(getProfileVariables(), name) ||
  ["cv", "picture", "secondAdvisor", "committee", "isCloud"].includes(name);

export const resolveDocumentProfile = (
  document: HighTexDocument,
): DocumentProfile => ({
  ...emptyAuthorProfile(),
  ...document.profile,
  committee: documentCommittee(document),
  isCloud: false,
  incomplete: !document.profile?.name.trim() || !document.profile?.nim.trim(),
});

export const normalizeAuthorProfile = (
  value: unknown,
): AuthorProfile | undefined => {
  return readAuthorProfile(value, "profile");
};
