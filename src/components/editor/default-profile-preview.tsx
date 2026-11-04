import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  defaultProfileChanges,
  defaultProfilePatch,
  type DefaultProfileChange,
  type DefaultProfileField,
} from "@/utils/default-profile-changes";
import { name } from "@/utils/name";
import { t, useAppLanguage } from "@/utils/lang";

function Value({ value }: { value: DefaultProfileChange["before"] }) {
  return (
    <span className="block break-words text-sm">
      {value.text
        ? value.nip !== undefined
          ? name(value.text)
          : value.text
        : t("document_profile.defaults.empty")}
      {value.nip && (
        <span className="mt-1 block text-xs text-muted-foreground">
          NIP: {value.nip}
        </span>
      )}
    </span>
  );
}

export function DefaultProfilePreview({
  current,
  defaults,
  intern,
  onApply,
  onClose,
}: {
  current: Partial<Profile> | undefined;
  defaults: Omit<Profile, "cv">;
  intern: boolean;
  onApply(patch: Partial<Profile>): void;
  onClose(): void;
}) {
  useAppLanguage();
  const changes = defaultProfileChanges(current, defaults, intern);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        changes
          .filter((change) => !change.clearsValue)
          .map((change) => change.field),
      ),
  );
  const chosen = new Set(
    changes
      .filter((change) => selected.has(change.field))
      .map((change) => change.field),
  );
  const toggle = (field: DefaultProfileField, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        data-default-profile-preview
        style={{ maxHeight: "calc(100dvh - 6rem)", top: "calc(50% + 1.5rem)" }}
        className="flex flex-col overflow-hidden sm:max-w-xl"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("document_profile.defaults.title")}</DialogTitle>
          <DialogDescription>
            {t("document_profile.defaults.description")}
          </DialogDescription>
        </DialogHeader>
        {!changes.length ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t("document_profile.defaults.unchanged")}
          </p>
        ) : (
          <>
            {changes.some((change) => change.clearsValue) && (
              <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed">
                {t("document_profile.defaults.empty_hint")}
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
              {changes.map((change) => (
                <label
                  key={change.field}
                  data-profile-change={change.field}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    className="mt-0.5"
                    aria-label={t(change.label)}
                    checked={selected.has(change.field)}
                    onCheckedChange={(checked) =>
                      toggle(change.field, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">
                      {t(change.label)}
                    </span>
                    <span className="mt-2 grid gap-3 sm:grid-cols-2">
                      <span>
                        <span className="mb-1 block text-xs text-muted-foreground">
                          {t("document_profile.defaults.before")}
                        </span>
                        <Value value={change.before} />
                      </span>
                      <span>
                        <span className="mb-1 block text-xs text-muted-foreground">
                          {t("document_profile.defaults.after")}
                        </span>
                        <Value value={change.after} />
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("document_profile.defaults.save_hint")}
            </p>
          </>
        )}
        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose}>
            {t(changes.length ? "common.cancel" : "common.close")}
          </Button>
          {changes.length > 0 && (
            <Button
              type="button"
              disabled={!chosen.size}
              onClick={() =>
                onApply(defaultProfilePatch(current, defaults, chosen, intern))
              }
            >
              {t("document_profile.defaults.apply")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
