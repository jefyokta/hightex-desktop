import { confirm, type ConfirmOptions } from "@/utils/confirm";

type Method<
  TThis,
  TArgs extends unknown[],
  TResult,
> = (
  this: TThis,
  ...args: TArgs
) => Promise<TResult>;

type ConfirmFactory<TArgs extends unknown[]> = (
  ...args: TArgs
) => ConfirmOptions | Promise<ConfirmOptions>;

type ConfirmDecorator<TArgs extends unknown[]> = <
  TThis,
  TResult,
>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<
    Method<TThis, TArgs, TResult>
  >,
) => void;

export function Confirm(
  options: ConfirmOptions,
): ConfirmDecorator<unknown[]>;

export function Confirm<TArgs extends unknown[]>(
  factory: ConfirmFactory<TArgs>,
): ConfirmDecorator<TArgs>;

export function Confirm(
  optionsOrFactory:
    | ConfirmOptions
    | ConfirmFactory<unknown[]>,
): ConfirmDecorator<unknown[]> {
  return function <
    TThis,
    TArgs extends unknown[],
    TResult,
  >(
    _target: object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<
      Method<TThis, TArgs, TResult>
    >,
  ): void {
    const original = descriptor.value;

    if (!original) {
      throw new Error("@Confirm can only be used on methods.");
    }

    descriptor.value = async function (
      this: TThis,
      ...args: TArgs
    ): Promise<TResult> {
      const options =
        typeof optionsOrFactory === "function"
          ? await optionsOrFactory(...args)
          : optionsOrFactory;

      if (!(await confirm(options))) {
        return undefined as TResult;
      }

      return original.apply(this, args);
    };
  };
}