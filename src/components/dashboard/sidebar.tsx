import {
  ChevronDown,
  CircleHelp,
  Cloud,
  FileStack,
  FileText,
  Folder,
  LogIn,
  LogOut,
  MoreHorizontal,
  Quote,
  Settings,
  SplitSquareVertical,
  Presentation,
  History,
  ArrowUpRight,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { enUS, id as indonesian } from "date-fns/locale";
import Hightex from "@/assets/hightex.svg";
import { ParsedItalic } from "@/utils/parse-italic";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { useLogoutModal } from "@/context/logout-modal-context";
import { useAuthModal } from "@/context/auth-modal-context";
import { t, useAppLanguage } from "@/utils/lang";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isWorkspacePageActive } from "./navigation";

type Props = {
  recent?: HighTexDocument[];
  onNavigate?: () => void;
  onGuide?: () => void;
};

export const Sidebar = ({ recent = [], onNavigate, onGuide }: Props) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const language = useAppLanguage();
  const { user } = useUser();
  const online = useOnline();
  const { openLogin } = useAuthModal();
  const { openLogout } = useLogoutModal();
  const cloudActive =
    pathname.startsWith("/dashboard/projects/cloud") ||
    pathname.startsWith("/dashboard/submissions");
  const [cloudOpen, setCloudOpen] = useState(cloudActive);
  useEffect(() => {
    if (cloudActive) setCloudOpen(true);
  }, [cloudActive]);
  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };
  const item = (path: string, icon: ReactNode, label: string) => (
    <button
      type="button"
      className="workspace-nav-item"
      aria-current={isWorkspacePageActive(pathname, path) ? "page" : undefined}
      onClick={() => go(path)}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <aside
      className="flex h-full min-h-0 w-60 shrink-0 flex-col bg-transparent px-4 pb-4"
      aria-label={t("workspace.navigation")}
    >
      <button
        type="button"
        onClick={() => go("/")}
        className="flex shrink-0 items-center gap-2.5 px-2 py-6 text-left focus-visible:outline-2 focus-visible:outline-ring"
        aria-label={t("workspace.home")}
      >
        <img src={Hightex} className="size-9 grayscale" alt="" />
        <div>
          <p className="text-lg font-semibold tracking-tight">
            HighTex<span style={{ color: "var(--workspace-brand)" }}>.</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {t("workspace.tagline")}
          </p>
        </div>
      </button>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-1 pb-6">
        <nav aria-label={t("workspace.primary")} className="space-y-1">
          <p className="workspace-eyebrow px-3 pb-2">{t("workspace.title")}</p>
          {item(
            "/dashboard/projects/local",
            <Folder size={17} />,
            t("workspace.documents"),
          )}
          {item(
            "/dashboard/citation",
            <Quote size={17} />,
            t("workspace.citations"),
          )}
          {item(
            "/dashboard/lecturers",
            <UsersRound size={17} />,
            t("lecturers.title"),
          )}
          <Collapsible open={cloudOpen} onOpenChange={setCloudOpen}>
            <CollapsibleTrigger className="workspace-nav-item">
              <Cloud size={17} />
              <span>{t("workspace.cloud")}</span>
              <ChevronDown
                className={`ml-auto size-3.5 transition-transform ${cloudOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-5 border-l pl-2 pt-1 space-y-1">
                {item(
                  "/dashboard/projects/cloud",
                  <Folder size={15} />,
                  t("workspace.cloud_documents"),
                )}
                {item(
                  "/dashboard/submissions",
                  <FileText size={15} />,
                  t("workspace.submissions"),
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
          {item(
            "/dashboard/snapshots",
            <History size={17} />,
            t("workspace.snapshots"),
          )}
        </nav>
        <nav aria-label={t("workspace.tools")} className="space-y-1">
          <p className="workspace-eyebrow px-3 pb-2">{t("workspace.tools")}</p>
          {item(
            "/dashboard/splitter",
            <SplitSquareVertical size={17} />,
            t("workspace.splitter"),
          )}
          {item(
            "/dashboard/present",
            <Presentation size={17} />,
            t("workspace.present"),
          )}
          {item(
            "/dashboard/forms",
            <FileStack size={17} />,
            t("workspace.forms"),
          )}
        </nav>
        <section aria-label={t("workspace.recent")}>
          <p className="workspace-eyebrow px-3 pb-3">{t("workspace.recent")}</p>
          {recent.length === 0 ? (
            <p className="px-3 text-xs leading-relaxed text-muted-foreground">
              {t("workspace.no_recent")}
            </p>
          ) : (
            <div className="space-y-1">
              {recent.slice(0, 5).map((doc) => {
                const date = doc.updatedAt
                  ? new Date(doc.updatedAt)
                  : undefined;
                const time =
                  date && Number.isFinite(date.getTime())
                    ? formatDistanceToNow(date, {
                        addSuffix: true,
                        locale: language === "id" ? indonesian : enUS,
                      })
                    : t("workspace.no_activity");
                return (
                  <button
                    type="button"
                    key={doc.id}
                    title={doc.title}
                    onClick={() => {
                      window.editor.open(doc.id, doc.file);
                      onNavigate?.();
                    }}
                    className="group flex w-full gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        <ParsedItalic
                          text={doc.title || t("common.untitled_document")}
                        />
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {time}
                      </p>
                    </div>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
      <div className="shrink-0 space-y-2 border-t pt-3">
        <button
          type="button"
          className="workspace-nav-item"
          onClick={() => {
            onNavigate?.();
            onGuide?.();
          }}
          disabled={!onGuide}
        >
          <CircleHelp size={17} />
          <span>{t("guide.replay")}</span>
        </button>
        {item("/settings", <Settings size={17} />, t("settings.title"))}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl bg-muted/35 px-3 py-3 text-left hover:bg-muted"
                aria-label={t("workspace.account")}
              >
                <span className="workspace-brand-icon flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {user.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {user.identity_number}
                  </span>
                </span>
                <MoreHorizontal className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onSelect={() => go("/settings")}>
                <Settings />
                {t("workspace.account")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={openLogout}>
                <LogOut />
                {t("common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="px-3 py-3">
            <p className="text-xs font-medium">
              {t("workspace.local_workspace")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t("workspace.login_hint")}
            </p>
            <button
              type="button"
              onClick={openLogin}
              disabled={!online}
              title={!online ? t("workspace.offline_login") : undefined}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <LogIn size={14} />
              {t("common.login")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
