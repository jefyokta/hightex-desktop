import { ErrorContext } from "@/context/error-context";
import { useContext } from "react";

export function useError() {
  const ctx = useContext(ErrorContext);

  if (!ctx) {
    throw new Error("useError must be used inside ErrorProvider");
  }

  return ctx;
}
