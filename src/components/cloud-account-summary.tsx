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
  const [profile, setProfile] = useState<DocumentProfile>();
  const [cached, setCached] = useState<Pick<
    Profile,
    "name" | "nim" | "cv"
  > | null>();
  const [data, setData] = useState<AccountProfileData>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    const refreshProfile = () => {
      void window.profile
        .get()
        .then((value) => {
          if (alive) setProfile(value);
        })
        .catch(() => undefined);
    };
    refreshProfile();
    const offProfile = window.profile.onChange?.(refreshProfile);
    window.addEventListener("focus", refreshProfile);
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
      offProfile?.();
      window.removeEventListener("focus", refreshProfile);
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
              {data?.name ??
                profile?.name ??
                cached?.name ??
                t("account_profile.unavailable")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("settings.profile.nim.label")}
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {data?.nim ??
                profile?.nim ??
                cached?.nim ??
                t("account_profile.unavailable")}
            </dd>
          </div>
          <ProfilePerson
            label={t("settings.profile.advisor.name.label")}
            person={{
              name: profile?.advisorName ?? "",
              nip: profile?.advisorNip ?? "",
            }}
          />
          {profile?.secondAdvisor && (
            <ProfilePerson
              label={t("settings.profile.second_advisor.name.label")}
              person={profile.secondAdvisor}
            />
          )}
        </dl>
        <section
          className="space-y-3"
          aria-label={t("document_profile.committee_title")}
        >
          <h3 className="text-sm font-medium">
            {t("document_profile.committee_title")}
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            <ProfilePerson
              label={t("editor.expandable.setting.leaded_by")}
              person={profile?.committee?.chair ?? { name: "", nip: "" }}
            />
            <ProfilePerson
              label={t("editor.expandable.setting.primary_examiner_name")}
              person={profile?.committee?.examiner1 ?? { name: "", nip: "" }}
            />
            <ProfilePerson
              label={t("editor.expandable.setting.secondary_examiner_name")}
              person={profile?.committee?.examiner2 ?? { name: "", nip: "" }}
            />
          </dl>
        </section>
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

function ProfilePerson({
  label,
  person,
}: {
  label: string;
  person: AcademicPerson;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">
        {person.name || t("account_profile.unavailable")}
      </dd>
      <dd className="text-xs text-muted-foreground">
        {t("lecturers.nip_label")}:{" "}
        {person.nip || t("account_profile.unavailable")}
      </dd>
    </div>
  );
}
