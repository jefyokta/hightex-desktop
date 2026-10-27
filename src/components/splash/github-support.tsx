import type { MouseEvent } from "react";
import { ArrowUpRight, GitFork, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/lang";

const repository = "https://github.com/jefyokta/hightex-desktop";

export function GitHubSupport() {
  const openRepository = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void window.file.openExternal(repository).catch(() => {
      toast.error(t("splash.github.open_failed"));
    });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <GitFork
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <a
            href={repository}
            target="_blank"
            rel="noopener noreferrer"
            onClick={openRepository}
            className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium hover:underline focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span className="break-all">jefyokta/hightex-desktop</span>
            <ArrowUpRight
              className="size-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("splash.github.description")}
          </p>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="gap-2 rounded-lg">
        <a
          href={repository}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openRepository}
        >
          <Star className="size-3.5" aria-hidden="true" />
          {t("splash.github.star")}
        </a>
      </Button>
    </div>
  );
}
