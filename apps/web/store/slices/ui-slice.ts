import { StateCreator } from "zustand";

export interface UISlice {
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  toggleCommandPalette: () => void;
}

// StateCreator explicitly types the slice, ensuring strict type safety when merged
export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
  toggleCommandPalette: () => set((state) => ({ isCommandPaletteOpen: !state.isCommandPaletteOpen })),
});
