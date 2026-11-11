import { create } from 'zustand';

export interface Fly {
  id: number;
  img: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

interface UiState {
  drawerOpen: boolean;
  /** Element that opened the drawer; focus returns here on close. */
  drawerReturnFocus: HTMLElement | null;
  fly: Fly | null;
  /** Increments on every add, alternating the bump animation so it replays. */
  bumpCount: number;
  justAdded: boolean;
  openDrawer: (trigger?: HTMLElement | null) => void;
  closeDrawer: () => void;
}

export const useUi = create<UiState>()((set) => ({
  drawerOpen: false,
  drawerReturnFocus: null,
  fly: null,
  bumpCount: 0,
  justAdded: false,
  openDrawer: (trigger) =>
    set({
      drawerOpen: true,
      drawerReturnFocus: trigger ?? (typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null),
    }),
  closeDrawer: () => set({ drawerOpen: false }),
}));
