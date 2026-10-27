import { Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { t } from "@/utils/lang";

const contributors = [
  "Muhammad Habib Rafi",
  "Kannaya Aurellia Firsiel",
  "Shifa Anjani Desha",
  "Prety Afriani",
];

export const ContributorsDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
        <Users className="size-3.5" aria-hidden="true" />
        {t("splash.contributors")}
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[85dvh] gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-lg">
      <DialogHeader className="rounded-t-2xl border-b bg-muted/30 px-6 pt-7 pb-6">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-lg border bg-background">
            <Heart
              className="size-3.5 text-[#6b8f71] dark:text-[#9bb59e]"
              aria-hidden="true"
            />
          </span>
          {t("splash.contributors")}
        </div>
        <DialogTitle className="text-2xl leading-tight font-semibold tracking-tight">
          {t("splash.made_together")}
        </DialogTitle>
        <DialogDescription className="max-w-sm text-xs leading-6">
          {t("splash.contributors_description")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 px-6 py-6">
        <section
          aria-label={t("splash.creator")}
          className="flex items-center gap-4 rounded-xl border bg-muted/20 p-4"
        >
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#6b8f71]/20 bg-[#6b8f71]/10 text-sm font-semibold text-[#6b8f71] dark:text-[#9bb59e]"
            aria-hidden="true"
          >
            JO
          </div>
          <div>
            <h3 className="text-sm font-semibold">Jepi Okta Mipa</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("splash.creator")}
            </p>
          </div>
        </section>
        <section aria-labelledby="splash-community-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3
              id="splash-community-title"
              className="text-xs font-medium text-muted-foreground"
            >
              {t("splash.community")}
            </h3>
            <span
              className="rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground"
              aria-hidden="true"
            >
              {contributors.length.toString().padStart(2, "0")}
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {contributors.map((name) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-xl border px-3 py-3"
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  {name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </span>
                <span className="text-xs leading-5 font-medium">{name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {t("splash.contributor_note")}
          </p>
        </section>
      </div>
    </DialogContent>
  </Dialog>
);
