import { strFromU8, unzipSync } from "fflate";

interface AcademicTransport {
  context(): CloudSession;
  request(
    endpoint: string,
  ): Promise<{ ok: boolean; status: number; data: unknown }>;
}
const fail = (code: string): never => {
  throw new Error(`cloud_error:${code}`);
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("academic_invalid");
  return value as Record<string, unknown>;
};
const text = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return fail("academic_invalid");
  return value;
};
const person = (value: unknown, identity = "identity_number") => {
  if (value === null || value === undefined) return { name: "", nip: "" };
  const data = record(value);
  return { name: text(data.name), nip: text(data[identity]) };
};

export const parseCloudAcademic = (me: unknown, university: unknown) => {
  const user = record(record(me).message);
  if (!Array.isArray(user.advisors)) return fail("academic_invalid");
  // /me.advisors is the backend projection of active mentorships. Never use
  // array order or the actor's first role to choose a document's advisors.
  const advisors = user.advisors.map(record);
  const primary = advisors.filter(
    (advisor) => advisor.advisor_role === "primary",
  );
  const secondary = advisors.filter(
    (advisor) => advisor.advisor_role === "secondary",
  );
  if (
    primary.length > 1 ||
    secondary.length > 1 ||
    advisors.some(
      (advisor) =>
        !["primary", "secondary"].includes(String(advisor.advisor_role)),
    )
  )
    return fail("academic_invalid");
  const thesis = user.thesis_data == null ? {} : record(user.thesis_data);
  if (
    thesis.student_id != null &&
    String(thesis.student_id) !== String(user.id)
  )
    return fail("academic_invalid");
  const officials = record(record(university).data);
  if (!("lead_program_study" in officials) || !("dean" in officials))
    return fail("academic_invalid");
  const first = person(primary[0]);
  return {
    accountId: String(user.id),
    author: {
      name: text(user.name),
      nim: text(user.identity_number),
      advisorName: first.name,
      advisorNip: first.nip,
      secondAdvisor: secondary.length ? person(secondary[0]) : undefined,
    },
    committee: {
      leader: person(thesis.session_chair).name,
      member_1: person(thesis.first_examiner).name,
      member_2: person(thesis.second_examiner).name,
      kaprodi: person(officials.lead_program_study, "nip"),
      dekan: person(officials.dean, "nip"),
    },
  };
};

export class CloudAcademicClient {
  constructor(private transport: AcademicTransport) {}

  private require(sessionId: string) {
    const session = this.transport.context();
    if (session.sessionId !== sessionId) return fail("session_changed");
    return session;
  }

  async load(input: {
    sessionId: string;
    serverDocumentId: string | null;
  }): Promise<CloudAcademicData> {
    const session = this.require(input.sessionId);
    const responses = await Promise.all(
      ["/me", "/university-data", "/document"].map((endpoint) =>
        this.transport.request(endpoint),
      ),
    );
    this.require(input.sessionId);
    for (const response of responses)
      if (!response.ok) return fail(`http_${response.status}`);
    const [me, university, document] = responses.map(
      (response) => response.data,
    );
    const owned = record(document).document;
    if (owned !== null && String(record(owned).author) !== session.accountId)
      return fail("cloud_changed");
    if (
      input.serverDocumentId !== null &&
      (!owned || String(record(owned).id) !== input.serverDocumentId)
    )
      return fail("cloud_changed");
    const parsed = parseCloudAcademic(me, university);
    if (parsed.accountId !== session.accountId) return fail("session_changed");
    return {
      session,
      serverDocumentId: owned ? String(record(owned).id) : null,
      author: parsed.author,
      committee: parsed.committee,
    };
  }

  async verify(
    input: Pick<CloudPushInput, "sessionId" | "file">,
    serverDocumentId: string | null,
  ) {
    const data = await this.load({
      sessionId: input.sessionId,
      serverDocumentId,
    });
    try {
      let size = 0;
      const entries = unzipSync(input.file, {
        filter: (entry) => {
          size += entry.originalSize;
          if (size > 128 * 1024 * 1024) throw new Error("Archive too large");
          return ["files/profile.json", "files/config.json"].includes(
            entry.name,
          );
        },
      });
      const profile = record(
        JSON.parse(strFromU8(entries["files/profile.json"])),
      );
      const config = record(
        JSON.parse(strFromU8(entries["files/config.json"])),
      );
      for (const key of ["name", "nim", "advisorName", "advisorNip"] as const)
        if (profile[key] !== data.author[key]) return fail("academic_changed");
      const second =
        profile.secondAdvisor == null
          ? undefined
          : person(profile.secondAdvisor, "nip");
      if (
        second?.name !== data.author.secondAdvisor?.name ||
        second?.nip !== data.author.secondAdvisor?.nip
      )
        return fail("academic_changed");
      for (const key of ["leader", "member_1", "member_2"] as const)
        if (config[key] !== data.committee[key])
          return fail("academic_changed");
      for (const key of ["kaprodi", "dekan"] as const) {
        const actual = person(config[key], "nip");
        if (
          actual.name !== data.committee[key].name ||
          actual.nip !== data.committee[key].nip
        )
          return fail("academic_changed");
      }
    } catch {
      return fail("academic_changed");
    }
  }
}
