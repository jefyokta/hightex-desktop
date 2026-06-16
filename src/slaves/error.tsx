import { ApplicationError } from "@/exception/interfaces/application-error";
import { DocumentNotFound } from "@/exception/document-not-found";
import {
  NotificationErrorLevel,
  ShouldNotified,
} from "@/exception/interfaces/should-notified";
import { useError } from "@/hooks/use-error";
import { toast } from "sonner";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShouldNotifiedWithNativeComponent } from "@/exception/interfaces/should-notified-with-native-component";

export const ErrorSlave: React.FC = () => {
  const { errors, clear } = useError();
  const go = useNavigate();

  const latestError = errors[0];

  useEffect(() => {
    if (!latestError) return;

    const err = latestError.error;

    if (!(err instanceof ApplicationError)) {
      // console.log("error",err)
      if (err === null) {
        console.log("tf are you throwing error as null");
        return;
      }
      throw err;
    }

    if (err instanceof ShouldNotified) {
      toast[err.level as NotificationErrorLevel](err.message, {
        description: err.description,
        id: err.id,
        action: err.action,
      });

      clear(latestError.id);
      return;
    }

    if (err instanceof DocumentNotFound) {
      toast.error(`Document ${err.doc.id} not found!`);

      clear(latestError.id);
      go("/dashboard/");
      return;
    }
    if (err instanceof ShouldNotifiedWithNativeComponent) {
      err.showNotification();
      return;
    }
  }, [latestError]);

  return null;
};
