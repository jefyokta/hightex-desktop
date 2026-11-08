import { useEffect, useState } from "react";
import { LoginGate } from "./login-gate";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useUser } from "@/hooks/use-user";
import { useOnline } from "@/hooks/use-online";
import { t } from "@/utils/lang";
import { toast } from "sonner";

export function CloudAccountSummary() {
  const { user } = useUser();
  const userId = user ? String(user.id) : undefined;
  const online = useOnline();
  const [cached, setCached] = useState<Pick<
    Profile,
    "name" | "nim" | "cv"
  > | null>();
  const [data, setData] = useState<AccountProfileData>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    void window.profile
      .cachedCloud()
      .then((value) => {
        if (alive) setCached(value);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    if (online && userId)
      void window.account
        .load()
        .then((result) => {
          if (!alive) return;
          if (result.ok) setData(result.data);
          else setFailed(true);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    return () => {
      alive = false;
    };
  }, [online, userId]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account_profile.title")}</CardTitle>
        <CardDescription>{t("account_profile.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("settings.profile.name.label")}
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.name ?? cached?.name ?? t("account_profile.unavailable")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("settings.profile.nim.label")}
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.nim ?? cached?.nim ?? t("account_profile.unavailable")}
            </dd>
          </div>
        </dl>
        {failed && (
          <p role="alert" className="text-xs text-destructive">
            {t("account_profile.errors.request_failed")}
          </p>
        )}
        {(!online || !userId) && (
          <p className="text-xs text-muted-foreground">{t("profile.cached")}</p>
        )}
        {online && !userId && <LoginGate compact />}
        {data && (
          <Button
            variant="outline"
            size="sm"
            disabled={!online || !userId}
            onClick={() => {
              void window.account
                .settings(data.session.sessionId)
                .then((result) => {
                  if (!result.ok)
                    toast.error(t(`account_profile.errors.${result.error}`));
                })
                .catch(() =>
                  toast.error(t("account_profile.errors.request_failed")),
                );
            }}
          >
            {t("account_profile.web_settings")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
