import { create } from "zustand";
import { ReactNode } from "react";

export type ContextMenuSeparator = {
  type: "separator";
};

export type ContextMenuAction = {
  type?: "item";
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
};

export type ContextMenuGroup = {
  type: "group";
  label: string;
  children: ContextMenuAction[];
};

export type ContextMenuItem =
  | ContextMenuAction
  | ContextMenuSeparator
  | ContextMenuGroup;

type ContextMenuStore = {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  target: HTMLElement | null;
  open: (
    x: number,
    y: number,
    items: ContextMenuItem[],
    target?: HTMLElement | null,
  ) => void;
  close: () => void;
};

export const useContextMenuStore = create<ContextMenuStore>((set) => ({
  visible: false,
  x: 0,
  y: 0,
  items: [],
  target: null,
  open: (x, y, items, target = null) =>
    set({ visible: true, x, y, items, target }),
  close: () => set({ visible: false, items: [], target: null }),
}));

export const openContextMenu = (
  x: number,
  y: number,
  items: ContextMenuItem[],
  target?: HTMLElement | null,
) => useContextMenuStore.getState().open(x, y, items, target);

export const closeContextMenu = () => useContextMenuStore.getState().close();
