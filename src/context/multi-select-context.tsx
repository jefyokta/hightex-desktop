import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MultiSelectState<T> = {
  selected: T[];
};

type MultiSelectContextValue = {
  states: Record<string, MultiSelectState<unknown>>;
  addSelected: <T>(name: string, value: T) => void;
  deselect: <T>(name: string, value: T) => void;
  toggleSelect: <T>(name: string, value: T) => void;
  clear: (name: string) => void;
  setSelected: <T>(name: string, value: T[]) => void;
};

export const MultiSelectContext =
  createContext<MultiSelectContextValue | null>(null);

type MultiSelectProviderProps = {
  children: ReactNode;
};

export function MultiSelectProvider({
  children,
}: MultiSelectProviderProps) {
  const [states, setStates] = useState<Record<string, MultiSelectState<unknown>>>({});

  const addSelected = useCallback(
    <T,>(name: string, value: T) => {
      setStates((current) => {
        const state = current[name] ?? {
          selected: [],
        };

        if (state.selected.includes(value)) {
          return current;
        }

        return {
          ...current,
          [name]: {
            selected: [...state.selected, value],
          },
        };
      });
    },
    [],
  );

  const deselect = useCallback(
    <T,>(name: string, value: T) => {
      setStates((current) => {
        const state = current[name];

        if (!state) {
          return current;
        }

        return {
          ...current,
          [name]: {
            selected: state.selected.filter(
              (item) => item !== value,
            ),
          },
        };
      });
    },
    [],
  );

  const toggleSelect = useCallback(
    <T,>(name: string, value: T) => {
      setStates((current) => {
        const state = current[name] ?? {
          selected: [],
        };

        const isSelected = state.selected.includes(value);

        return {
          ...current,
          [name]: {
            selected: isSelected
              ? state.selected.filter((item) => item !== value)
              : [...state.selected, value],
          },
        };
      });
    },
    [],
  );

  const clear = useCallback((name: string) => {
    setStates((current) => ({
      ...current,
      [name]: {
        selected: [],
      },
    }));
  }, []);

  const setSelected = useCallback(
    <T,>(name: string, value: T[]) => {
      setStates((current) => ({
        ...current,
        [name]: {
          selected: value,
        },
      }));
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      states,
      addSelected,
      deselect,
      toggleSelect,
      clear,
      setSelected,
    }),
    [
      states,
      addSelected,
      deselect,
      toggleSelect,
      clear,
      setSelected,
    ],
  );

  return (
    <MultiSelectContext.Provider value={contextValue}>
      {children}
    </MultiSelectContext.Provider>
  );
}