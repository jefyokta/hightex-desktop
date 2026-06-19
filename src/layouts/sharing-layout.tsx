import { Outlet } from "react-router-dom";
import { SharingContextProvider } from "@/hooks/use-sharing";
import { ExpandableSharingSidebar } from "@/components/sharing/expandable-sidebar";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFrame, FrameContext } from "@/hooks/use-frame";

export const SharingLayout = () => {
  const { iframeRef, frameDoc, setHtml, FramePortal } = useFrame();

  return (
    <SharingContextProvider>
      <FrameContext.Provider value={{ doc: frameDoc, iframeRef, setHtml }}>
        <div className="flex h-screen w-full overflow-hidden bg-background">
          <main className="flex-1 overflow-auto">
            <div className="flex flex-col justify-center h-screen w-full max-w-7xl bg-white">
              <iframe
                ref={iframeRef}
                style={{ border: "none", width: "100%", height: "100%" }}
              />
              <FramePortal>
                <Outlet />
              </FramePortal>
            </div>
          </main>

          <aside
            className={cn(
              "hidden md:flex",
              "w-90 shrink-0 border-l bg-muted/20",
              "h-screen sticky top-0",
            )}
          >
            <div className="flex h-full w-full flex-col">
              <TooltipProvider>
                <ExpandableSharingSidebar />
              </TooltipProvider>
            </div>
          </aside>
        </div>
      </FrameContext.Provider>
    </SharingContextProvider>
  );
};
