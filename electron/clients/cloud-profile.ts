import { parseCloudAuthor } from "./cloud-academic-client";

/** Login responses may omit assignments; only a complete /me projection replaces them. */
export const cloudProfileFromUser = (
  user: User,
  cached?: Partial<Profile>,
): Profile => {
  const raw = user as User & { cv?: unknown };
  const author =
    "thesis_data" in user ? parseCloudAuthor(user).author : undefined;
  return {
    advisorName: "",
    advisorNip: "",
    committee: {},
    ...cached,
    ...author,
    name: user.name,
    nim: user.identity_number ?? cached?.nim ?? "",
    cv:
      typeof raw.cv === "string"
        ? raw.cv
        : raw.cv === null
          ? ""
          : (cached?.cv ?? ""),
  };
};
