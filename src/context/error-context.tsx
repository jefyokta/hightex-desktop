import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Manager } from "../editor/manager";

type ErrorItem = {
  error: unknown;
  timestamp: number;
};

type ErrorContextValue = {
  error: ErrorItem | null;
  clear: () => void;
};

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<ErrorItem | null>(null);

  useEffect(() => {
    return Manager.app.onError((payload) => {
      console.log(payload);
    });
  }, []);

  const value = useMemo(() => {
    return {
      error,
      clear() {
        setError(null);
      },
    };
  }, [error]);

  return (
    <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>
  );
}

export function useError() {
  const ctx = useContext(ErrorContext);

  if (!ctx) {
    throw new Error("useError must be used inside ErrorProvider");
  }

  return ctx;
}
