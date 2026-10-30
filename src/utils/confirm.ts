export type ConfirmOptions = {
  title: string;
  desc?: string;
  confirmText?: string;
  cancelText?: string;
};

export type AlternativeConfirmOptions = ConfirmOptions & {
  alternativeText: string;
};
export type ConfirmDialogOptions = ConfirmOptions & {
  alternativeText?: string;
};
export type ConfirmResult = boolean | "alternative";

export interface Confirm {
  (title: string): Promise<boolean>;
  (options: ConfirmOptions): Promise<boolean>;
}

let instance:
  | ((options: ConfirmDialogOptions) => Promise<ConfirmResult>)
  | null = null;

export function registerConfirm(
  fn: (options: ConfirmDialogOptions) => Promise<ConfirmResult>,
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
    }).then((result) => result === true);
  }

  return instance(arg).then((result) => result === true);
};

export function confirmWithAlternative(
  options: AlternativeConfirmOptions,
): Promise<ConfirmResult> {
  if (!instance) throw new Error("ConfirmProvider is not mounted");
  return instance(options);
}
