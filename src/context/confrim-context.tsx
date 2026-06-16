import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { registerConfirm, type ConfirmOptions } from "@/utils/confirm";

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null,
  );

  useEffect(() => {
    registerConfirm((options) => {
      return new Promise<boolean>((resolve) => {
        setOptions(options);
        setResolver(() => resolve);
        setOpen(true);
      });
    });
  }, []);

  const close = (result: boolean) => {
    resolver?.(result);

    setOpen(false);
    setOptions(null);
    setResolver(null);
  };

  return (
    <>
      {children}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            close(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>

            {options?.desc && (
              <DialogDescription>{options.desc}</DialogDescription>
            )}
          </DialogHeader>

          <DialogFooter>
            <Button variant="secondary" onClick={() => close(false)}>
              {options?.cancelText ?? "Cancel"}
            </Button>

            <Button onClick={() => close(true)}>
              {options?.confirmText ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
