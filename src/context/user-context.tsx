import { createContext, useEffect, useState } from "react";

type UserContextType = {
  user: User | false;
  refresh: () => Promise<void>;
};

export const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | false>(false);

  const refresh = async () => {
    const res = await window.session.user();
    setUser(res || false);
  };

  useEffect(() => {
    refresh();

    const unsubscribe = window.session.onChange?.((u: User | false) => {
      setUser(u);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

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
