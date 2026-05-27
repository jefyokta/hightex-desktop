import { createContext, PropsWithChildren, useContext, useState } from "react";

const ParamsContext = createContext<{ params: string[]; setParams: any }>({
  params: [],
  setParams: () => {},
});

export const ParamsContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [params, setParams] = useState([]);

  return (
    <ParamsContext.Provider value={{ params, setParams }}>
      {children}
    </ParamsContext.Provider>
  );
};

export const useParams = () => useContext(ParamsContext);
