import { MultiSelectContext } from "@/context/multi-select-context";
import { useContext } from "react";

export function useMultiSelect<T>(name: string) {
  const context = useContext(MultiSelectContext);

  if (!context) {
    throw new Error(
      "useMultiSelect must be used inside MultiSelectProvider",
    );
  }

  const selected =
    (context.states[name]?.selected as T[] | undefined) ?? [];

  return {
    selected,

    addSelected: (value: T) =>
      context.addSelected(name, value),

    deselect: (value: T) =>
      context.deselect(name, value),

    clear: () =>
      context.clear(name),

    setSelected: (value: T[]) =>
      context.setSelected(name, value),
    toggleSelect: (value: T) => {
      context.toggleSelect(name, value)
    }
  };
}