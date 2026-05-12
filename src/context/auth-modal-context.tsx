import { createContext, useContext, useState } from "react";

type AuthModalContextType = {
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
};

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export const AuthModalProvider = ({ children }: any) => {
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = () => setLoginOpen(true);
  const closeLogin = () => setLoginOpen(false);

  return (
    <AuthModalContext.Provider
      value={{
        loginOpen,
        openLogin,
        closeLogin,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
};

export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used inside provider");
  return ctx;
};
