import { ApplicationError } from "@/exception/interfaces/application-error";
import { ThrowByMain } from "@/exception/interfaces/throw-by-main";

type Ctor<T extends ApplicationError = ApplicationError> = new (
  ...args: any[]
) => T;
const registry = new Map<string, Ctor>();

export function RegisterMainError(tag: string) {
  return function <T extends Ctor>(target: T): T {
    registry.set(tag, target);
    return target;
  };
}

export function reconstructMainError(
  err: unknown,
  fallback: (message: string) => ApplicationError,
): ApplicationError {
  const tag = ApplicationError.getMainErrorName(err);
  const rawMessage = ApplicationError.normilize(err);
  const Found = registry.get(tag || "");
  if (!Found) return fallback(rawMessage);

  const message = rawMessage.split(":").slice(3).join(":");
  const e = new Found(message);
  return e instanceof ThrowByMain ? e.onMainThrowing(message) : e;
}
