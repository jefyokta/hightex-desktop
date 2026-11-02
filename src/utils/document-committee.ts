const legacyRoles = {
  chair: "leader",
  examiner1: "member_1",
  examiner2: "member_2",
} as const;

type CommitteeDocument = Pick<HighTexDocument, "profile" | "config">;

/** An explicit committee, even {}, is authoritative. Never resurrect cleared roles. */
export function documentCommittee(
  document: CommitteeDocument,
): AcademicCommittee {
  if (document.profile?.committee !== undefined)
    return document.profile.committee;
  const committee: AcademicCommittee = {};
  for (const role of Object.keys(legacyRoles) as (keyof AcademicCommittee)[]) {
    const name = document.config[legacyRoles[role]];
    if (typeof name === "string" && name.trim())
      committee[role] = { name, nip: "" };
  }
  return committee;
}

/** Used by DB upgrades and import. Pure and idempotent; never reads the viewer profile. */
export function migrateDocumentCommittee<T extends CommitteeDocument>(
  document: T,
): T {
  const hasLegacy = Object.values(legacyRoles).some((key) =>
    Object.prototype.hasOwnProperty.call(document.config, key),
  );
  if (!hasLegacy) return document;
  const committee = documentCommittee(document);
  const config = { ...document.config };
  for (const key of Object.values(legacyRoles)) delete config[key];
  // Preserve a genuinely absent author when there is no assignment to migrate.
  const profile =
    document.profile || Object.keys(committee).length
      ? {
          name: "",
          nim: "",
          advisorName: "",
          advisorNip: "",
          cv: "",
          ...document.profile,
          committee,
        }
      : undefined;
  return { ...document, config, profile };
}

/** Compatibility projection at the archive boundary, not a second runtime source. */
export function legacyCommitteeConfig(
  document: CommitteeDocument,
): HighTexConfig {
  if (document.profile?.committee === undefined) return document.config;
  const config = { ...document.config };
  for (const role of Object.keys(legacyRoles) as (keyof AcademicCommittee)[]) {
    config[legacyRoles[role]] = document.profile.committee[role]?.name ?? "";
  }
  return config;
}
