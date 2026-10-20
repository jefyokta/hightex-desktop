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
  ["cv", "picture", "secondAdvisor", "isCloud"].includes(name);

export const resolveDocumentProfile = (
  document: HighTexDocument,
): DocumentProfile => ({
  ...emptyAuthorProfile(),
  ...document.profile,
  isCloud: false,
  incomplete: !document.profile?.name.trim() || !document.profile?.nim.trim(),
});

export const normalizeAuthorProfile = (
  value: unknown,
): AuthorProfile | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid document profile");
  }

  const raw = value as Record<string, unknown>;
  const profile = emptyAuthorProfile();
  for (const key of [
    "name",
    "nim",
    "advisorName",
    "advisorNip",
    "cv",
  ] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") {
      throw new Error(`Invalid document profile: ${key}`);
    }
    profile[key] = (raw[key] as string | undefined) ?? "";
  }

  if (raw.secondAdvisor !== undefined && raw.secondAdvisor !== null) {
    const advisor = raw.secondAdvisor as Record<string, unknown>;
    if (
      typeof advisor !== "object" ||
      Array.isArray(advisor) ||
      typeof advisor.name !== "string" ||
      typeof advisor.nip !== "string"
    ) {
      throw new Error("Invalid document profile: secondAdvisor");
    }
    profile.secondAdvisor = { name: advisor.name, nip: advisor.nip };
  }
  return profile;
};
