// import { ConfigService } from "./config-service";
import { ProfileService } from "./profile-service";
// import { SessionService } from "./session-service";

export class DocumentProfileService {
  /**
   * 
   * temporary commented bcs we wont update the cloud features before v1.0.0
   * 
   * commented from version v0.6.1+
   * 
   */
  static get(): DocumentProfile {
    // const config = ConfigService.get();
    // const user = SessionService.getUser();

    // if (config.editor?.preferCloudProfile && user?.email && user?.name) {
    //   const advisor =
    //     user.advisors?.[0] ??
    //     user.advisors?.find((advisor) => advisor.role === "primary");
    //   return {
    //     name: user.name,
    //     nim: user.identity_number || "",
    //     advisorName: advisor?.name || "Advisor",
    //     advisorNip: advisor?.identity_number || "1111",
    //     isCloud: true,
    //   };
    // }

    return {
      ...ProfileService.get(),
      isCloud: false,
    };
  }
}
