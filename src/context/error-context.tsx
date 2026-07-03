import { createContext, useEffect, useMemo, useState } from "react";
import { Manager } from "../editor/manager";

type ErrorItem = {
  id: string;
  error: unknown;
  timestamp: number;
};

type ErrorContextValue = {
  errors: ErrorItem[];
  clear: (id?: string) => void;
  clearAll: () => void;
  addError: (err: ErrorItem) => void;
};

export const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<ErrorItem[]>([]);

  useEffect(() => {
    return Manager.app.onError((payload) => {
      const newError: ErrorItem = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        error: payload.error,
        timestamp: Date.now(),
      };

      setErrors((prev) => [newError, ...prev]);
    });
  }, []);

  const value = useMemo(() => {
    return {
      errors,

      clear(id?: string) {
        if (!id) {
          setErrors([]);
          return;
        }

        setErrors((prev) => prev.filter((e) => e.id !== id));
      },

      clearAll() {
        setErrors([]);
      },
      addError(er: ErrorItem) {
        setErrors((e) => [...e, er]);
      },
    };
  }, [errors]);

  return (
    <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
  );
}
