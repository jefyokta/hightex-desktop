const legacyRoles = {
  chair: "leader",
  examiner1: "member_1",
  examiner2: "member_2",
} as const;

type CommitteeDocument = Pick<HighTexDocument, "profile" | "config">;

/** An explicit committee, even {}, is authoritative. Never resurrect cleared roles. */
export function migrateLegacyCommittee(
  legacy: object,
  current?: AcademicCommittee,
): AcademicCommittee {
  if (current !== undefined) return current;
  const committee: AcademicCommittee = {};
  const fields = legacy as Record<string, unknown>;
  for (const role of Object.keys(legacyRoles) as (keyof AcademicCommittee)[]) {
    const name = fields[legacyRoles[role]];
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
  const committee = migrateLegacyCommittee(
    document.config,
    document.profile?.committee,
  );
  const config = withoutLegacyCommittee(document.config);
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

/** Strip legacy committee keys before any document config is serialized. */
export function withoutLegacyCommittee(value: HighTexConfig): HighTexConfig {
  const config = { ...value } as HighTexConfig & Record<string, unknown>;
  for (const key of Object.values(legacyRoles)) delete config[key];
  return config;
}
