import { CloudError } from "@/exception/cloud-error";
import { emptyAuthorProfile } from "./document-profile";
import {
  migrateLegacyCommittee,
  withoutLegacyCommittee,
} from "./document-committee";

type AcademicData = Pick<CloudAcademicData, "author" | "committee">;
const academicAuthor = (data: AcademicData): CloudAcademicData["author"] => ({
  ...structuredClone(data.author),
  committee: structuredClone(
    migrateLegacyCommittee(data.committee, data.author.committee),
  ),
});
const academicOfficials = (
  data: AcademicData,
): Pick<CloudAcademicData["committee"], "kaprodi" | "dekan"> => ({
  kaprodi: structuredClone(data.committee.kaprodi),
  dekan: structuredClone(data.committee.dekan),
});

/** Apply only server-owned fields; local CV/photos, dates and content stay editable. */
export const applyCloudAcademic = (
  document: HighTexDocument,
  data: AcademicData,
): HighTexDocument => ({
  ...document,
  profile: {
    ...emptyAuthorProfile(),
    ...document.profile,
    ...academicAuthor(data),
    secondAdvisor: data.author.secondAdvisor
      ? structuredClone(data.author.secondAdvisor)
      : undefined,
  },
  config: {
    ...withoutLegacyCommittee(document.config),
    ...academicOfficials(data),
  },
});

export const preserveCloudAcademic = (
  current: HighTexDocument | undefined,
  next: HighTexDocument,
): HighTexDocument => {
  if (!current?.cloudAcademic) return { ...next, cloudAcademic: undefined };
  return {
    ...applyCloudAcademic(next, current.cloudAcademic),
    cloudAcademic: {
      ...structuredClone(current.cloudAcademic),
      author: academicAuthor(current.cloudAcademic),
      committee: academicOfficials(current.cloudAcademic),
    },
  };
};

export const withCloudAcademicSource = (
  document: HighTexDocument,
  data: CloudAcademicData,
): HighTexDocument => {
  if (!data.serverDocumentId) throw new CloudError("cloud_changed");
  return {
    ...applyCloudAcademic(document, data),
    cloudAcademic: {
      accountId: data.session.accountId,
      serverUrl: data.session.serverUrl,
      serverDocumentId: data.serverDocumentId,
      author: academicAuthor(data),
      committee: academicOfficials(data),
    },
  };
};
