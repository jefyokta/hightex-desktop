import { ConfigService } from "./config-service";
import { ProfileService } from "./profile-service";
import { SessionService } from "./session-service";

export class DocumentProfileService {
  static get(): DocumentProfile {
    const config = ConfigService.get();
    const user = SessionService.getUser();

    if (config.editor?.preferCloudProfile && user?.email && user?.name) {
      const advisor =
        user.advisors?.[0] ??
        user.advisors?.find((advisor) => advisor.role === "primary");
      const advisorEmail = advisor?.email ?? user.email;

      return {
        name: user.name,
        nim: user.email.split("@")[0] || "",
        advisorName: advisor?.name || "Advisor",
        advisorNip: advisorEmail.split("@")[0] || "",
        isCloud: true,
      };
    }

    return {
      ...ProfileService.get(),
      isCloud: false,
    };
  }
}
