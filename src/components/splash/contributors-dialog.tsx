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
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-muted">
          <Heart className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <DialogTitle>{t("splash.contributors")}</DialogTitle>
        <DialogDescription>
          {t("splash.contributors_description")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-5 py-2">
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("splash.creator")}
          </h3>
          <div className="rounded-xl border px-4 py-3 text-sm font-medium">
            Jepi Okta Mipa
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {t("splash.community")}
          </h3>
          <ul className="divide-y rounded-xl border">
            {contributors.map((name) => (
              <li key={name} className="px-4 py-3 text-sm">
                {name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DialogContent>
  </Dialog>
);
