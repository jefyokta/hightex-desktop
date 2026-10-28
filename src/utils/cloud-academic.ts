import { CloudError } from "@/exception/cloud-error";
import { emptyAuthorProfile } from "./document-profile";

/** Apply only server-owned fields; local CV/photos, dates and content stay editable. */
export const applyCloudAcademic = (
  document: HighTexDocument,
  data: Pick<CloudAcademicData, "author" | "committee">,
): HighTexDocument => ({
  ...document,
  profile: {
    ...emptyAuthorProfile(),
    ...document.profile,
    ...structuredClone(data.author),
    secondAdvisor: data.author.secondAdvisor
      ? structuredClone(data.author.secondAdvisor)
      : undefined,
  },
  config: { ...document.config, ...structuredClone(data.committee) },
});

export const preserveCloudAcademic = (
  current: HighTexDocument | undefined,
  next: HighTexDocument,
): HighTexDocument => {
  if (!current?.cloudAcademic) return { ...next, cloudAcademic: undefined };
  return {
    ...applyCloudAcademic(next, current.cloudAcademic),
    cloudAcademic: structuredClone(current.cloudAcademic),
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
      author: structuredClone(data.author),
      committee: structuredClone(data.committee),
    },
  };
};
