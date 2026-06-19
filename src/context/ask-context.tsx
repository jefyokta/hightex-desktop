import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { registerAsk, type AskOptions } from "@/utils/ask";
import { ActionCanceled } from "@/exception/action-canceled";

export function AskProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const [options, setOptions] = useState<AskOptions | null>(null);

  const [value, setValue] = useState("");

  const [resolver, setResolver] = useState<
    ((value: string | undefined) => void) | null
  >(null);
  const [rejector, setRejector] = useState<
    ((err: ActionCanceled) => void) | null
  >(null);

  useEffect(() => {
    registerAsk((options) => {
      return new Promise<string | undefined>((resolve, reject) => {
        setOptions(options);
        setValue(options.defaultValue ?? "");
        setResolver(() => resolve);
        setRejector(() => reject);
        setOpen(true);
      });
    });
  }, []);

  const close = (result: string | undefined) => {
    if (typeof result == "undefined") {
      rejector?.(new ActionCanceled(options?.title));
    } else {
      resolver?.(result);
    }

    setOpen(false);
    setValue("");
    setOptions(null);
    setResolver(null);
    setRejector(null);
  };

  return (
    <>
      {children}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="max-w-[80%]">{options?.title}</DialogTitle>

            <DialogDescription>
              {options?.desc || "Please fill to continue"}
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={value}
            type={options?.hidden ? "password" : "text"}
            placeholder={options?.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                close(value);
              }
            }}
          />

          <DialogFooter>
            <Button variant="secondary" onClick={() => close(undefined)}>
              {options?.cancelText ?? "Cancel"}
            </Button>

            <Button onClick={() => close(value)}>
              {options?.submitText ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
