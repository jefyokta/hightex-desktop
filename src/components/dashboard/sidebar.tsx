import {
  Cloud,
  FileText,
  Folder,
  LucideScreenShare,
  Quote,
  Settings,
  SplitSquareVerticalIcon,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { isMac } from "../../utils/is-mac";
import Hightex from "./../../assets/hightex.svg";
import { formatDistanceToNow } from "date-fns";
import { useUser } from "../../hooks/use-user";
import { useLogoutModal } from "../../context/logout-modal-context";
import { useAuthModal } from "../../context/auth-modal-context";
type Props = {
  recent?: HighTexDocument[];
};

export const Sidebar = ({ recent = [] }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { openLogin } = useAuthModal();

  const isActive = (path: string) => location.pathname === path;

  const navItem = (path: string, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => navigate(path)}
      className={`flex w-full items-center gap-2 text-xs p-2 rounded-lg transition
        ${
          isActive(path)
            ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className={`w-56 h-full p-4 ${isMac && "pt-2"}
      bg-neutral-50 dark:bg-neutral-950 flex flex-col  `}
    >
      <div>
        {!isMac && (
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <img src={Hightex} className="w-10" alt="" />
            HighTex
          </div>
        )}

        <div className="mb-4">
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mb-2">
            Workspace
          </div>

          <div className="space-y-1">
            {navItem(
              "/dashboard/projects/local",
              <Folder size={14} />,
              "Local Project",
            )}
            {navItem(
              "/dashboard/projects/cloud",
              <Cloud size={14} />,
              "Remote Project",
            )}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mb-2">
            Recent
          </div>

          {recent.length === 0 ? (
            <div className="text-[11px] text-neutral-500 px-2 py-1">
              No recent documents
            </div>
          ) : (
            <div className="space-y-1">
              {recent.slice(0, 5).map((doc) => {
                const time = doc.updatedAt
                  ? formatDistanceToNow(new Date(doc.updatedAt), {
                      addSuffix: true,
                    })
                  : null;

                return (
                  <button
                    key={doc.id}
                    onClick={() => navigate(`/document/${doc.id}`)}
                    className="w-full flex items-center space-x-2 text-left px-2 py-2 rounded-md
                      hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                  >
                    <FileText
                      size={20}
                      className="text-neutral-500 dark:text-neutral-400"
                    />
                    <div className="w-full">
                      <div className="text-xs text-neutral-800 dark:text-neutral-200 w-40 truncate">
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
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mb-2">
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
          </div>
        </div>

        <div>
          <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mb-2">
            Others
          </div>

          <div className="space-y-1">
            {navItem("/dashboard/citation", <Quote size={14} />, "Citation")}
            {!isMac && navItem("/settings", <Settings size={14} />, "Settings")}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase mb-2">
          Local Ready
        </div>

        <div className="text-[11px] rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
          {user ? (
            <Avatar user={user} />
          ) : (
            <div className="w-full flex justify-center p-2">
              <div
                onClick={openLogin}
                className="bg-neutral-900 dark:bg-neutral-800 cursor-pointer p-1.5 px-2 rounded-lg w-full text-center text-white"
              >
                Sign In
              </div>
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
    <div
      className="relative flex gap-2 items-center cursor-pointer"
      onClick={() => {
        openLogout();
      }}
    >
      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-medium text-neutral-100 relative z-10">
        {user.name[0].toUpperCase()}
      </div>
      <div>
        <div className="text-neutral-500">{user.name}</div>
        <div className="text-neutral-400">{user.email.split("@")[0]}</div>
      </div>
    </div>
  );
};
