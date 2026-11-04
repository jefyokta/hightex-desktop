import { useRef } from "react";
import { ArrowRight, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { t, useAppLanguage } from "@/utils/lang";
import "@/css/ui-guides.css";

export function GuideAnnouncement({ guide }: { guide: GuideController }) {
  useAppLanguage();
  const starting = useRef(false);
  const { plan, activeGuide, phase, selectGuide, startTour, dismiss } = guide;
  if (!plan || !activeGuide) return null;
  const headerInset = Math.max(
    0,
    document.querySelector("[data-editor-titlebar]")?.getBoundingClientRect()
      .bottom ?? 0,
  );
  const replay = plan.mode === "replay";
  const releases = [...new Set(plan.guides.map((item) => item.version))];
  return (
    <Dialog
      open={phase === "intro"}
      onOpenChange={(open) => {
        if (!open) void dismiss();
      }}
    >
      <DialogContent
        data-guide-announcement
        overlayClassName="guide-announcement-scrim"
        style={{
          maxHeight: `calc(100dvh - ${headerInset + 32}px)`,
          top: `calc(50% + ${headerInset / 2}px)`,
        }}
        className="workspace guide-surface flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-6 sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          if (starting.current) event.preventDefault();
        }}
      >
        <div className="workspace-brand-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
          <CircleHelp className="size-5" />
        </div>
        <div className="shrink-0 space-y-2 pr-5">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t(
              replay
                ? "guide.library_title"
                : plan.mode === "welcome"
                  ? "guide.welcome_title"
                  : "guide.whats_new_title",
            )}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            {t(
              replay
                ? "guide.library_description"
                : "guide.announcement_description",
            )}
          </DialogDescription>
        </div>
        {replay ? (
          <div className="min-h-0 space-y-3 overflow-y-auto">
            <label
              className="block text-xs font-medium"
              htmlFor="guide-library-feature"
            >
              {t("guide.feature")}
            </label>
            <NativeSelect
              id="guide-library-feature"
              value={activeGuide.id}
              onChange={(event) => selectGuide(event.target.value)}
            >
              {plan.guides.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.name)}
                </option>
              ))}
            </NativeSelect>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t(activeGuide.summary)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("guide.version_label", { version: activeGuide.version })}
            </p>
          </div>
        ) : (
          <div
            className="min-h-0 space-y-5 overflow-y-auto pr-1"
            data-guide-release-list
          >
            {releases.map((version) => (
              <section key={version} data-guide-release={version}>
                <p className="workspace-eyebrow mb-2">
                  {t("guide.version_label", { version })}
                </p>
                <ul className="divide-y divide-border/60">
                  {plan.guides
                    .filter((item) => item.version === version)
                    .map((item) => (
                      <li
                        key={item.id}
                        data-guide-id={item.id}
                        className="py-3 first:pt-0 last:pb-0"
                      >
                        <p className="text-sm font-medium">{t(item.name)}</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {t(item.summary)}
                        </p>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        <div className="mt-1 flex shrink-0 items-center justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" onClick={() => void dismiss()}>
            {t(replay ? "common.close" : "guide.skip")}
          </Button>
          <Button
            size="sm"
            className="guide-primary"
            onClick={() => {
              starting.current = true;
              startTour();
            }}
          >
            {t(replay ? "guide.start_feature" : "guide.continue_tour")}
            <ArrowRight />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
