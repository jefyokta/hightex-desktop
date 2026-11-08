import { AccountProfile } from "@/components/account-profile";
import { DefaultProfileSection } from "@/components/default-profile-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { t } from "@/utils/lang";

export const Profile = () => (
  <>
    <PageHeader
      title={t("profile.title")}
      description={t("profile.description")}
    />
    <AccountProfile />
    <DefaultProfileSection />
  </>
);
