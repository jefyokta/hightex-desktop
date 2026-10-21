import {
  ChevronDown,
  Cloud,
  FileStack,
  FileText,
  Folder,
  LucideScreenShare,
  Quote,
  Settings,
  SplitSquareVerticalIcon,
  Timeline,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import * as locales from "date-fns/locale";

import { isMac } from "../../utils/is-mac";
import Hightex from "../../assets/hightex.svg";
import { useUser } from "../../hooks/use-user";
import { useLogoutModal } from "../../context/logout-modal-context";
import { useAuthModal } from "../../context/auth-modal-context";
import { useLocale } from "@/hooks/use-locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

type Props = {
  recent?: HighTexDocument[];
};

export const Sidebar = ({ recent = [] }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { openLogin } = useAuthModal();
  const { locale } = useLocale();

  const isActive = (path: string) => location.pathname === path;

  const navItem = (path: string, icon: React.ReactNode, label: string) => (
    <button
      key={path}
      onClick={() => navigate(path)}
      className={`flex w-full items-center gap-2 rounded-lg p-2 text-xs transition
        ${
          isActive(path)
            ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  const cloudPaths = ["/dashboard/projects/cloud", "/dashboard/submissions"];

  const isCloudActive = cloudPaths.some(isActive);

  return (
    <div
      className={`flex h-full w-56 flex-col bg-neutral-50 p-4 dark:bg-neutral-950 ${
        isMac ? "pt-2" : ""
      }`}
    >
      <div>
        {!isMac && (
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <img src={Hightex} className="w-10" alt="" />
            HighTex
          </div>
        )}

        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
            Workspace
          </div>

          <div className="space-y-1">
            {navItem(
              "/dashboard/projects/local",
              <Folder size={14} />,
              "Local Project",
            )}

            <Collapsible defaultOpen={isCloudActive}>
              <CollapsibleTrigger asChild>
                <button
                  className={`group flex w-full items-center gap-2 rounded-lg p-2 text-xs transition
                    ${
                      isCloudActive
                        ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                >
                  <Cloud size={14} />
                  <span>Cloud</span>
                  <ChevronDown
                    size={14}
                    className="ml-auto shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="overflow-hidden">
                <div className="ml-3 mt-1 space-y-1 border-l border-neutral-200 pl-2 dark:border-neutral-800">
                  {navItem(
                    "/dashboard/projects/cloud",
                    <Folder size={14} />,
                    "Projects",
                  )}

                  {navItem(
                    "/dashboard/submissions",
                    <FileText size={14} />,
                    "Submissions",
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {navItem(
              "/dashboard/snapshots",
              <Timeline size={14} />,
              "Snapshots",
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
            Recent
          </div>

          {recent.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-neutral-500">
              No recent documents
            </div>
          ) : (
            <div className="ms-2 space-y-1">
              {recent.slice(0, 5).map((doc) => {
                const time = doc.updatedAt
                  ? formatDistanceToNow(new Date(doc.updatedAt), {
                      addSuffix: true,
                      // @ts-ignore date-fns locale mapping
                      locale: locales[locale],
                    })
                  : null;

                return (
                  <button
                    key={doc.id}
                    onClick={() => window.editor.open(doc.id, doc.file)}
                    className="flex w-full items-center space-x-2 rounded-md text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <FileText
                      size={14}
                      className="shrink-0 text-neutral-500 dark:text-neutral-400"
                    />

                    <div className="w-full min-w-0">
                      <div className="w-40 truncate text-xs text-neutral-800 dark:text-neutral-200">
                        {doc.title || "Untitled"}
                      </div>

                      <div className="text-[8px] text-neutral-400">
                        {time ?? "No activity"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className="mb-2 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
            Tools
          </div>

          <div className="space-y-1">
            {navItem(
              "/dashboard/splitter",
              <SplitSquareVerticalIcon size={14} />,
              "Splitter",
            )}

            {navItem(
              "/dashboard/present",
              <LucideScreenShare size={14} />,
              "Present",
            )}

            {navItem("/dashboard/forms", <FileStack size={14} />, "Forms")}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] uppercase text-neutral-400 dark:text-neutral-500">
            Others
          </div>

          <div className="space-y-1">
            {navItem("/dashboard/citation", <Quote size={14} />, "Citation")}

            {!isMac && navItem("/settings", <Settings size={14} />, "Settings")}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-lg bg-neutral-100 p-2 text-[11px] dark:bg-neutral-900">
          {user ? (
            <Avatar user={user} />
          ) : (
            <div className="flex w-full justify-center p-2">
              <button
                onClick={openLogin}
                className="w-full cursor-pointer rounded-lg bg-neutral-900 p-1.5 text-center text-white dark:bg-neutral-800"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Avatar = ({ user }: { user: User }) => {
  const { openLogout } = useLogoutModal();

  return (
    <button
      type="button"
      className="relative flex w-full items-center gap-2 text-left"
      onClick={openLogout}
    >
      <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-medium text-neutral-100">
        {user.name[0]?.toUpperCase()}
      </div>

      <div className="min-w-0">
        <div className="truncate text-neutral-500">{user.name}</div>
        <div className="truncate text-neutral-400">{user.identity_number}</div>
      </div>
    </button>
  );
};
