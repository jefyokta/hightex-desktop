import { Button } from "@/components/ui/button";
import { ShouldNotified } from "./interfaces/should-notified";

export class CategoryEmpty extends ShouldNotified<"error"> {
  level: "error" = "error";
  constructor() {
    super({
      message: "Categories is missing!",
      description: "Try to get online or reinstall the app",
      action: (
        <Button
          onClick={() => {
            location.href = "/";
          }}
        >
          Back
        </Button>
      ),
    });
  }
}
