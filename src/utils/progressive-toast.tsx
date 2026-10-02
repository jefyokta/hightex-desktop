import { toast } from "sonner";
import { ApplicationError } from "@/exception/interfaces/application-error";
import { truncate } from "@/utils/truncate";

interface ProgressiveToastOptions {
  initialStatus?: string;
  initialProgress?: number;
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface SuccessOptions {
  title: string;
  description?: string;
  duration?: number;
  action?: ToastAction;
  cancel?: ToastAction;
}

interface ErrorOptions {
  title: string;
  error?: unknown;
  duration?: number;
}

const renderProgress = (status: string, progress: number) => (
  <div className="flex flex-col gap-1.5 w-full min-w-60">
    <div className="flex justify-between items-center text-xs font-semibold">
      <span className="truncate pr-2">{status}</span>
      <span className="text-neutral-500 font-mono">{progress}%</span>
    </div>
    <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full overflow-hidden">
      <div
        className="bg-black dark:bg-white h-full transition-all duration-300 rounded-full"
        style={{ width: `${Math.max(progress, 5)}%` }}
      />
    </div>
  </div>
);

const renderSuccess = (title: string, description?: string) => (
  <div className="flex flex-col gap-1">
    <span className="font-semibold text-sm">{title}</span>
    {description && (
      <span className="text-xs text-neutral-500 truncate max-w-60">
        {description}
      </span>
    )}
  </div>
);

export const progressiveToast = ({
  initialStatus = "processing...",
  initialProgress = 5,
}: ProgressiveToastOptions = {}) => {
  const id = toast.loading(renderProgress(initialStatus, initialProgress));

  return {
    id,

    update: (status: string, progress: number) => {
      toast.loading(
        renderProgress(status, Math.max(progress, initialProgress)),
        {
          id,
        },
      );
    },

    success: ({
      title,
      description,
      duration = 8000,
      action,
      cancel,
    }: SuccessOptions) => {
      toast.success(renderSuccess(title, description), {
        id,
        duration,
        action,
        cancel,
      });
    },

    info: (message: string, duration = 3000) => {
      toast.dismiss(id);
      toast.info(message, { duration });
    },

    error: ({ title, error, duration = 8000 }: ErrorOptions) => {
      let normalized = error;

      if (normalized instanceof Error) {
        const parts = normalized.message.split(":");
        normalized = parts[parts.length - 1] || normalized.message;
      }

      toast.error(title, {
        id,
        duration,
        description: error
          ? truncate(ApplicationError.normilize(normalized), 150)
          : undefined,
      });
    },

    dismiss: () => toast.dismiss(id),
  };
};
