import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

type AuthModalContextType = {
  loginOpen: boolean;
  openLogin: () => void;
  closeLogin: () => void;
};

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export const AuthModalProvider = ({ children }: PropsWithChildren) => {
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);
  const value = useMemo(
    () => ({ loginOpen, openLogin, closeLogin }),
    [loginOpen, openLogin, closeLogin],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
};

// Keep the provider and its existing consumer hook together.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuthModal = () => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used inside provider");
  return ctx;
};
