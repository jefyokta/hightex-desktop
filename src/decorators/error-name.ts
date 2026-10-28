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
  fallback: (message: string, err?: unknown) => ApplicationError,
): ApplicationError {
  const rawMessage = ApplicationError.normilize(err);
  for (const [tag, Found] of registry) {
    const marker = `${tag}:`;
    const index = rawMessage.indexOf(marker);
    if (index === -1) continue;

    const message = rawMessage.slice(index + marker.length).trim();
    const error = new Found(message);
    return error instanceof ThrowByMain ? error.onMainThrowing(message) : error;
  }
  return fallback(rawMessage, err);
}
