import { createContext, useCallback, useEffect, useRef, useState } from "react";

type UserContextType = {
  user: User | false;
  refresh: () => Promise<void>;
};

// The existing provider and its shared context are kept together.
// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | false>(false);

  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++revision.current;
    const res = await window.session.user();
    if (request === revision.current) setUser(res || false);
  }, []);

  useEffect(() => {
    const unsubscribe = window.session.onChange?.((u: User | false) => {
      revision.current += 1;
      setUser(u);
    });

    void refresh();
    return () => {
      revision.current += 1;
      unsubscribe?.();
    };
  }, [refresh]);

  return (
    <UserContext.Provider
      value={{
        user,
        refresh,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
