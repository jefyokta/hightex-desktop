import { createContext, PropsWithChildren, useContext, useState } from "react";
import { LogoutModal } from "../components/logout-modal";

type LogoutContextType = {
  logoutOpen: boolean;
  openLogout: () => void;
  closeLogout: () => void;
};

export const LogoutModalContext = createContext<LogoutContextType>({
  logoutOpen: false,
  openLogout: () => {},
  closeLogout: () => {},
});

export const LogoutModalProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const openLogout = () => setOpen(true);
  const closeLogout = () => setOpen(false);
  return (
    <LogoutModalContext.Provider
      value={{ openLogout, logoutOpen: open, closeLogout }}
    >
      {children}
      <LogoutModal />
    </LogoutModalContext.Provider>
  );
};

export const useLogoutModal = () => useContext(LogoutModalContext);
