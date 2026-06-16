export type AskOptions = {
  title: string;
  desc?: string;
  placeholder?: string;
  defaultValue?: string;
  submitText?: string;
  cancelText?: string;
};

export interface Ask {
  (title: string): Promise<string | undefined>;
  (options: AskOptions): Promise<string | undefined>;
}

let instance: ((options: AskOptions) => Promise<string | undefined>) | null =
  null;

export function registerAsk(
  fn: (options: AskOptions) => Promise<string | undefined>,
) {
  instance = fn;
}

export const ask: Ask = (
  arg: string | AskOptions,
): Promise<string | undefined> => {
  if (!instance) {
    throw new Error("AskProvider is not mounted");
  }

  if (typeof arg === "string") {
    return instance({
      title: arg,
    });
  }

  return instance(arg);
};
