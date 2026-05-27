import "./../App.css";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorProvider } from "@/context/error-context";
import { UserProvider } from "@/context/user-context";
import { AuthModalProvider } from "@/context/auth-modal-context";
import { LogoutModalProvider } from "@/context/logout-modal-context";

import { LoginModal } from "@/components/login-modal";
import { ErrorSlave } from "@/slaves/error";
import { Toaster } from "sonner";

const applyTheme = (theme: "light" | "dark" | "system") => {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
    return;
  }

  if (theme === "light") {
    root.classList.remove("dark");
    return;
  }

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  root.classList.toggle("dark", systemDark);
};

export const MainLayout = () => {
  useEffect(() => {
    const config = window.config.get();

    const theme = config?.theme ?? "system";
    applyTheme(theme);

    const unsubscribe = window.config.onChange((cfg) => {
      applyTheme(cfg.theme);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <ErrorProvider>
      <ErrorSlave />
      <TooltipProvider>
        <UserProvider>
          <AuthModalProvider>
            <LogoutModalProvider>
              <LoginModal />
              <Outlet />
            </LogoutModalProvider>
          </AuthModalProvider>
        </UserProvider>
        <Toaster
          // richColors
          position="bottom-right"
          theme={window.config.get()?.theme || "system"}
          className="flex justify-between toasta"
          // duration={Infinity}
          // richColors
        />
      </TooltipProvider>
    </ErrorProvider>
  );
};
