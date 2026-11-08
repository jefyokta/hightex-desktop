import type { LocaleKey } from "@/utils/lang";

export const workspacePages: Array<{ path: string; label: LocaleKey }> = [
  { path: "/dashboard/projects/local", label: "workspace.documents" },
  { path: "/dashboard/citation", label: "workspace.citations" },
  { path: "/dashboard/lecturers", label: "lecturers.title" },
  { path: "/dashboard/projects/cloud", label: "workspace.cloud_documents" },
  { path: "/dashboard/cloud/cv", label: "cloud_cv.navigation" },
  { path: "/dashboard/submissions", label: "workspace.submissions" },
  { path: "/dashboard/snapshots", label: "workspace.snapshots" },
  { path: "/dashboard/splitter", label: "workspace.splitter" },
  { path: "/dashboard/present", label: "workspace.present" },
  { path: "/dashboard/forms", label: "workspace.forms" },
  { path: "/profile", label: "profile.title" },
  { path: "/settings", label: "settings.title" },
];

export const isWorkspacePageActive = (pathname: string, path: string) =>
  (path === "/dashboard/projects/local" && pathname === "/dashboard") ||
  pathname === path ||
  pathname.startsWith(`${path}/`);

export const workspacePageLabel = (pathname: string): LocaleKey =>
  workspacePages.find(({ path }) => isWorkspacePageActive(pathname, path))
    ?.label ?? "workspace.title";
