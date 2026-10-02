import {
  createContext,
  Dispatch,
  PropsWithChildren,
  useContext,
  useState,
} from "react";

const ParamsContext = createContext<{
  params: string[];
  setParams: Dispatch<string[]>;
}>({
  params: [],
  setParams: () => {},
});

export const ParamsContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [params, setParams] = useState<string[]>([]);

  return (
    <ParamsContext.Provider value={{ params, setParams }}>
      {children}
    </ParamsContext.Provider>
  );
};

export const useParams = () => useContext(ParamsContext);
