import { WorkspaceGuide } from "@/components/dashboard/workspace-guide";
import { useUIGuide } from "@/hooks/use-ui-guide";
import { Outlet, useLocation } from "react-router-dom";
import { Menu, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { workspacePageLabel } from "@/components/dashboard/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isMac } from "@/utils/is-mac";
import { HighTexDB } from "@/editor/storage/hightex-db";
import { Manager } from "@/editor/manager";
import { useOnline } from "@/hooks/use-online";
import { t, useAppLanguage } from "@/utils/lang";
import "@/css/workspace.css";

export const AppLayout = () => {
  useAppLanguage();
  const guide = useUIGuide();
  const { pathname } = useLocation();
  const online = useOnline();
  const [recent, setRecent] = useState<HighTexDocument[]>([]);
  const [navigationOpen, setNavigationOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    let revision = 0;
    const fillRecent = async () => {
      const request = ++revision;
      const docs = await HighTexDB.getInstance().documents.toArray();
      if (!alive || request !== revision) return;
      setRecent(
        docs
          .filter((doc) => doc.updatedAt)
          .sort(
            (a, b) =>
              new Date(b.updatedAt!).getTime() -
              new Date(a.updatedAt!).getTime(),
          )
          .slice(0, 5),
      );
    };
    const refresh = () => {
      void fillRecent().catch(console.error);
    };
    refresh();
    const offUpdated = Manager.app.on("document:updated", refresh);
    const offDeleted = Manager.app.on("documents:deleted", refresh);
    return () => {
      alive = false;
      offUpdated();
      offDeleted();
    };
  }, []);

  return (
    <div className="workspace flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {isMac && <div className="drag-bar h-8 shrink-0" aria-hidden="true" />}
      <a
        href="#workspace-content"
        className="sr-only z-50 rounded-lg bg-background p-3 focus:not-sr-only focus:absolute"
      >
        {t("workspace.skip_content")}
      </a>
      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block">
          <Sidebar recent={recent} onGuide={() => void guide.replay()} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col lg:pr-3 lg:pb-3">
          <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-5 lg:px-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-lg p-2 hover:bg-muted lg:hidden"
                aria-label={t("workspace.open_navigation")}
                onClick={() => setNavigationOpen(true)}
              >
                <Menu className="size-5" />
              </button>
              <p className="truncate text-xs text-muted-foreground">
                <span className="hidden sm:inline">
                  {t("workspace.title")}
                  <span className="mx-2 opacity-40">/</span>
                </span>
                <span className="font-medium text-foreground">
                  {t(workspacePageLabel(pathname))}
                </span>
              </p>
            </div>
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
              title={t("workspace.offline_ready")}
            >
              {online ? (
                <span className="size-1.5 rounded-full bg-foreground/50" />
              ) : (
                <WifiOff className="size-3" />
              )}
              {online ? t("workspace.local_workspace") : t("splash.offline")}
            </span>
          </header>
          <main
            id="workspace-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-auto bg-background outline-none "
          >
            <div
              key={pathname}
              className="mx-auto min-h-full w-full max-w-6xl space-y-7 p-5 sm:p-8 xl:p-10"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
        <DialogContent className="workspace top-0 left-0 h-dvh w-64 max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-r bg-background p-0 sm:max-w-64">
          <DialogTitle className="sr-only">
            {t("workspace.navigation")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("workspace.navigation_description")}
          </DialogDescription>
          <Sidebar
            recent={recent}
            onGuide={() => void guide.replay()}
            onNavigate={() => setNavigationOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <WorkspaceGuide guide={guide} />
    </div>
  );
};
