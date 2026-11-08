import { useEffect, useState } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/utils/lang";

export function useProfileDraft() {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void window.application.setProfileDraftBusy(busy).catch(console.error);
    return () => {
      void window.application.setProfileDraftBusy(false).catch(console.error);
    };
  }, [busy]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (dirty || busy) && currentLocation.pathname !== nextLocation.pathname,
  );
  useBeforeUnload((event) => {
    if (!dirty && !busy) return;
    event.preventDefault();
    event.returnValue = "";
  });
  useEffect(() => {
    if (!dirty && !busy && blocker.state === "blocked") blocker.proceed();
  }, [dirty, busy, blocker]);
  return {
    onDirtyChange: setDirty,
    onBusyChange: setBusy,
    guard: (
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t(busy ? "profile.save_pending" : "profile.leave_title")}
            </DialogTitle>
            <DialogDescription>
              {t(
                busy
                  ? "profile.save_pending_description"
                  : "profile.leave_description",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              {t("profile.stay")}
            </Button>
            {!busy && (
              <Button
                onClick={() => {
                  if (blocker.state === "blocked") blocker.proceed();
                }}
              >
                {t("profile.discard")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
  };
}
