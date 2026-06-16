export type ConfirmOptions = {
  title: string;
  desc?: string;
  confirmText?: string;
  cancelText?: string;
};

export interface Confirm {
  (title: string): Promise<boolean>;
  (options: ConfirmOptions): Promise<boolean>;
}

let instance: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

export function registerConfirm(
  fn: (options: ConfirmOptions) => Promise<boolean>,
) {
  instance = fn;
}

export const confirm: Confirm = (
  arg: string | ConfirmOptions,
): Promise<boolean> => {
  if (!instance) {
    throw new Error("ConfirmProvider is not mounted");
  }

  if (typeof arg === "string") {
    return instance({
      title: arg,
    });
  }

  return instance(arg);
};
