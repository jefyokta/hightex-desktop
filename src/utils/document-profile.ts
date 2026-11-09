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
let unsubscribeFrame: (() => void) | undefined;

export const invalidateWorkspaceAuthorProfile = () => {
  workspaceAuthorProfile = undefined;
};

const getProfileWindow = (): Window => {
  if (window.profile) return window;
  // Preview frames have no Electron preload. Same-origin access keeps the
  // profile scoped to the editor's host; a different origin cannot read it.
  try {
    if (window.parent !== window && window.parent.profile) return window.parent;
  } catch {
    // Cross-origin parents cannot provide this workspace's identity.
  }
  throw Error("Workspace profile API is not available.");
};

const unsubscribeWorkspaceProfile = () => {
  unsubscribeProfile?.();
  unsubscribeSession?.();
  unsubscribeFrame?.();
  unsubscribeProfile = undefined;
  unsubscribeSession = undefined;
  unsubscribeFrame = undefined;
  subscribedWindow = undefined;
  invalidateWorkspaceAuthorProfile();
};

export const getWorkspaceAuthorProfile =
  async (): Promise<WorkspaceAuthorProfile> => {
    const profileWindow = getProfileWindow();
    if (subscribedWindow !== profileWindow) {
      unsubscribeWorkspaceProfile();
      subscribedWindow = profileWindow;
      unsubscribeProfile = profileWindow.profile.onChange?.(
        invalidateWorkspaceAuthorProfile,
      );
      unsubscribeSession = profileWindow.session?.onChange?.(
        invalidateWorkspaceAuthorProfile,
      );
      if (profileWindow !== window) {
        const frame = window;
        frame.addEventListener("pagehide", unsubscribeWorkspaceProfile, {
          once: true,
        });
        unsubscribeFrame = () =>
          frame.removeEventListener("pagehide", unsubscribeWorkspaceProfile);
      }
    }
    if (workspaceAuthorProfile) return workspaceAuthorProfile;
    const pending = (async () => {
      const profile = (await profileWindow.profile.get()) as DocumentProfile;
      const bytes = await profileWindow.profile.picture();
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
