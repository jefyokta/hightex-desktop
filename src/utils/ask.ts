export type AskOptions = {
  title: string;
  desc?: string;
  placeholder?: string;
  defaultValue?: string;
  submitText?: string;
  cancelText?: string;
  hidden?: boolean;
};

export interface Ask {
  (title: string, hidden?: boolean): Promise<string | undefined>;
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
  hidden?: boolean,
): Promise<string | undefined> => {
  if (!instance) {
    throw new Error("AskProvider is not mounted");
  }

  if (typeof arg === "string") {
    return instance({
      title: arg,
      hidden: hidden,
    });
  }

  return instance(arg);
};
