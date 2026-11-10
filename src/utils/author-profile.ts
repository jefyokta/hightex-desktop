export const emptyAuthorProfile = (): AuthorProfile => ({
  name: "",
  nim: "",
  advisorName: "",
  advisorNip: "",
  cv: "",
});

export type WorkspaceAuthorProfile = Partial<AuthorProfile> & {
  isCloud?: boolean;
};

export const resolveAuthorProfile = (
  document: Pick<HighTexDocument, "profile">,
  workspaceProfile?: WorkspaceAuthorProfile,
): AuthorProfile => {
  const profile = {
    ...emptyAuthorProfile(),
    ...document.profile,
    committee: document.profile?.committee ?? {},
  };
  if (!workspaceProfile) return profile;

  // The active workspace is the only author-profile source. This also keeps
  // older documents and imported archives from restoring a second identity.
  const authorProfile = { ...workspaceProfile };
  delete authorProfile.isCloud;
  return {
    ...emptyAuthorProfile(),
    ...authorProfile,
    committee: authorProfile.committee ?? {},
    picture: authorProfile.picture,
  };
};
