import { readAuthorProfile } from "@hightex/importer";
import {
  resolveAuthorProfile,
  type WorkspaceAuthorProfile,
} from "./author-profile";
export { emptyAuthorProfile, resolveAuthorProfile } from "./author-profile";

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
  workspaceProfile?: WorkspaceAuthorProfile,
): DocumentProfile => {
  const profile = resolveAuthorProfile(document, workspaceProfile);
  return {
    ...profile,
    isCloud: Boolean(workspaceProfile?.isCloud),
    incomplete: !profile.name.trim() || !profile.nim.trim(),
  };
};

let workspaceAuthorProfile: Promise<WorkspaceAuthorProfile> | undefined;
let subscribedWindow: Window | undefined;
let unsubscribeProfile: (() => void) | undefined;
let unsubscribeSession: (() => void) | undefined;

export const invalidateWorkspaceAuthorProfile = () => {
  workspaceAuthorProfile = undefined;
};

export const getWorkspaceAuthorProfile =
  (): Promise<WorkspaceAuthorProfile> => {
    if (subscribedWindow !== window) {
      unsubscribeProfile?.();
      unsubscribeSession?.();
      subscribedWindow = window;
      invalidateWorkspaceAuthorProfile();
      unsubscribeProfile = window.profile.onChange?.(
        invalidateWorkspaceAuthorProfile,
      );
      unsubscribeSession = window.session?.onChange?.(
        invalidateWorkspaceAuthorProfile,
      );
    }
    if (workspaceAuthorProfile) return workspaceAuthorProfile;
    const pending = (async () => {
      const profile = (await window.profile.get()) as DocumentProfile;
      const bytes = await window.profile.picture();
      return {
        name: profile.name,
        nim: profile.nim,
        advisorName: profile.advisorName,
        advisorNip: profile.advisorNip,
        secondAdvisor: profile.secondAdvisor,
        committee: profile.committee ?? {},
        cv: profile.cv,
        picture: bytes
          ? new Blob([new Uint8Array(bytes)], { type: "image/webp" })
          : undefined,
        isCloud: profile.isCloud,
      } satisfies WorkspaceAuthorProfile;
    })();
    workspaceAuthorProfile = pending;
    void pending.catch(() => {
      if (workspaceAuthorProfile === pending)
        invalidateWorkspaceAuthorProfile();
    });
    return pending;
  };

export const resolveWorkspaceDocumentProfile = async (
  document: HighTexDocument,
): Promise<DocumentProfile> =>
  resolveDocumentProfile(document, await getWorkspaceAuthorProfile());

export const normalizeAuthorProfile = (
  value: unknown,
): AuthorProfile | undefined => {
  return readAuthorProfile(value, "profile");
};
