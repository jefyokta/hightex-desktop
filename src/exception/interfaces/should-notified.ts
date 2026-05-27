import { uniqId } from "@/utils/uniq-id";
import { ApplicationError } from "./application-error";

export type NotificationErrorLevel = "warning" | "error";

export class ShouldNotified<
  TLevel extends NotificationErrorLevel = "warning",
> extends ApplicationError {
  readonly level: TLevel = "warning" as TLevel;
  readonly message: string;
  readonly description: string;
  readonly id: string;
  readonly action?: React.ReactNode;

  constructor({
    message,
    description,
    action,
    id,
  }: {
    message: string;
    description: string;
    action?: React.ReactNode;
    id?: string;
  }) {
    super(message);
    this.message = message;
    this.description = description;
    this.id = id || uniqId();
    this.action = action;
  }
}
