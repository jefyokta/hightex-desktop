import { ApplicationError } from "@/exception/interfaces/application-error";
import { DocumentNotFound } from "@/exception/document-not-found";
import {
  type NotificationErrorLevel,
  ShouldNotified,
} from "@/exception/interfaces/should-notified";
import { useError } from "@/hooks/use-error";
import { toast } from "sonner";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShouldNotifiedWithNativeComponent } from "@/exception/interfaces/should-notified-with-native-component";
import { ShouldNavigated } from "@/exception/interfaces/should-navigated";
import { ShouldReport } from "@/exception/should-report";
import type { NavigateFunction } from "react-router-dom";
import { truncate } from "@/utils/truncate";
import { reconstructMainError } from "@/decorators/error-name";

export const ErrorSlave: React.FC = () => {
  const { errors, clear } = useError();
  const go = useNavigate();

  const latestError = errors[0];

  const handleError = (err: unknown, id: string, go: NavigateFunction) => {
    if (err === null) {
      clear(id);
      return;
    }
    const error: ApplicationError =
      err instanceof ApplicationError
        ? err
        :  reconstructMainError(err, (e) => new ShouldReport(e))




    if (error instanceof ShouldNotified) {
      toast[error.level as NotificationErrorLevel](
        truncate(error.message, 100),
        {
          description: truncate(error.description, 100),
          id: error.id,
          action: error.action,
        },
      );
      clear(id);
      return;
    }

    if (error instanceof DocumentNotFound) {
      toast.error(`Document ${error.doc.id} not found!`);
      clear(id);
      go("/dashboard/");
      return;
    }

    if (error instanceof ShouldNotifiedWithNativeComponent) {
      error.showNotification();
      clear(id);
      return;
    }

    if (error instanceof ShouldNavigated) {
      go(error.navigateTo);
      clear(id);
      return;
    }

    clear(id);
  };

  useEffect(() => {
    if (!latestError) return;
    handleError(latestError.error, latestError.id, go);
  }, [latestError]);

  return null;
};
