/**
 * Zustand store for contrast mode state
 * Manages high contrast mode preference
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyContrastMode,
  getInitialContrastMode,
  type ContrastMode
} from '../theme/highContrast';

interface ContrastStore {
  contrast: ContrastMode;
  setContrast: (contrast: ContrastMode) => void;
  toggleContrast: () => void;
}

export const useContrastStore = create<ContrastStore>()(
  persist(
    (set, get) => ({
      contrast: getInitialContrastMode(),
      setContrast: (contrast) => {
        set({ contrast });
        applyContrastMode(contrast);
      },
      toggleContrast: () => {
        const current = get().contrast;
        const newContrast = current === 'high' ? 'normal' : 'high';
        set({ contrast: newContrast });
        applyContrastMode(newContrast);
      }
    }),
    {
      name: 'contrast-storage',
      onRehydrateStorage: () => (state) => {
        // Apply contrast mode on rehydration
        if (state) {
          applyContrastMode(state.contrast);
        }
      }
    }
  )
);
