import { LoggerService } from "@main/service/logger-service";

export function LogOnError(context = "default", file = "error-log") {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.catch((err: unknown) => {
            LoggerService.write(err, context, file);
            throw err;
          });
        }

        return result;
      } catch (err) {
        LoggerService.write(err, context, file);
        throw err;
      }
    };

    return descriptor;
  };
}
