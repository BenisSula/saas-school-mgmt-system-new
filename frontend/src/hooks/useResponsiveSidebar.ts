import { useCallback, useEffect, useMemo, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 640px)';

export interface ResponsiveSidebarState {
  isOpen: boolean;
  isDesktop: boolean;
  toggle: () => void;
  close: () => void;
  shouldShowOverlay: boolean;
}

export function useResponsiveSidebar(initialOpen = false): ResponsiveSidebarState {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return false;
    }
    return window.matchMedia(DESKTOP_QUERY).matches;
  });
  const [menuOpen, setMenuOpen] = useState<boolean>(initialOpen);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(DESKTOP_QUERY);
    const updateFromQuery = (desktop: boolean) => {
      setIsDesktop(desktop);
      setMenuOpen(desktop);
    };

    updateFromQuery(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => updateFromQuery(event.matches);
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, []);

  const toggle = useCallback(() => {
    if (isDesktop) {
      return;
    }
    setMenuOpen((prev) => !prev);
  }, [isDesktop]);

  const close = useCallback(() => {
    if (isDesktop) {
      return;
    }
    setMenuOpen(false);
  }, [isDesktop]);

  const isOpen = useMemo(() => (isDesktop ? true : menuOpen), [isDesktop, menuOpen]);
  const shouldShowOverlay = !isDesktop && isOpen;

  return {
    isOpen,
    isDesktop,
    toggle,
    close,
    shouldShowOverlay
  };
}

export default useResponsiveSidebar;

