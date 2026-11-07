import { app } from "electron";
import { join } from "path";
import fs from "fs";

let record: GuideInstallationRecord | undefined;
let launch:
  | { firstInstalled: boolean; previousVersion: string | null }
  | undefined;

const filename = () => join(app.getPath("userData"), "installed.json");
const validDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

function persist(next: GuideInstallationRecord) {
  const file = filename();
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(next, null, 2));
  fs.renameSync(temporary, file);
}

function load(): GuideInstallationRecord {
  if (record) return record;
  const version = app.getVersion();
  const exists = fs.existsSync(filename());
  let previous: Partial<GuideInstallationRecord> = {};
  if (exists) {
    const raw = fs.readFileSync(filename(), "utf8");
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object")
        previous = parsed as Partial<GuideInstallationRecord>;
      else if (validDate(parsed)) previous.installedAt = parsed;
    } catch {
      // Older installations stored a plain ISO timestamp, rather than JSON.
      if (validDate(raw)) previous.installedAt = raw;
    }
  }
  const seenGuides = Object.fromEntries(
    Object.entries(previous.seenGuides ?? {}).filter(
      ([id, revision]) =>
        /^[a-z0-9-]{1,100}$/.test(id) &&
        Number.isSafeInteger(revision) &&
        revision > 0,
    ),
  );
  const next: GuideInstallationRecord = {
    schema: 1,
    installedAt: validDate(previous.installedAt)
      ? previous.installedAt
      : new Date().toISOString(),
    installedVersion:
      typeof previous.installedVersion === "string"
        ? previous.installedVersion
        : exists
          ? null
          : version,
    lastVersion: version,
    seenGuides,
    profileSetupPending: previous.profileSetupPending === true || !exists,
  };
  // Commit before caching, so a failed write can be retried.
  persist(next);
  launch = {
    firstInstalled: !exists,
    previousVersion:
      typeof previous.lastVersion === "string" ? previous.lastVersion : null,
  };
  record = next;
  return record;
}

export const firstInstalled = (): OnboardingStatus => {
  const current = load();
  return {
    time: current.installedAt,
    firstInstalled: launch!.firstInstalled,
    installedVersion: current.installedVersion,
    currentVersion: current.lastVersion,
    previousVersion: launch!.previousVersion,
    versionChanged:
      launch!.previousVersion !== null &&
      launch!.previousVersion !== current.lastVersion,
    seenGuides: { ...current.seenGuides },
    profileSetupPending: current.profileSetupPending,
  };
};

export function acknowledgeProfileSetup(): OnboardingStatus {
  const current = load();
  if (!current.profileSetupPending) return firstInstalled();
  const next: GuideInstallationRecord = {
    ...current,
    profileSetupPending: false,
  };
  persist(next);
  record = next;
  return firstInstalled();
}

export function acknowledgeGuides(
  guides: GuideAcknowledgment[],
): OnboardingStatus {
  if (
    !Array.isArray(guides) ||
    guides.length > 100 ||
    guides.some(
      (guide) =>
        !guide ||
        typeof guide.id !== "string" ||
        !/^[a-z0-9-]{1,100}$/.test(guide.id) ||
        !Number.isSafeInteger(guide.revision) ||
        guide.revision < 1,
    )
  ) {
    throw new Error("Invalid guide acknowledgments");
  }
  const current = load();
  const next: GuideInstallationRecord = {
    ...current,
    seenGuides: { ...current.seenGuides },
  };
  for (const guide of guides)
    next.seenGuides[guide.id] = Math.max(
      next.seenGuides[guide.id] ?? 0,
      guide.revision,
    );
  persist(next);
  record = next;
  return firstInstalled();
}
