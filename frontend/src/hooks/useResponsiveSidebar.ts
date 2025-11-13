import { useCallback, useEffect, useMemo, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';
const SIDEBAR_COLLAPSED_KEY = 'saas-sidebar-collapsed';

export interface ResponsiveSidebarState {
  isOpen: boolean;
  isDesktop: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  shouldShowOverlay: boolean;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

interface UseResponsiveSidebarOptions {
  initialOpen?: boolean;
  storageKey?: string;
}

function readCollapsedPref(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(key);
  return stored === 'true';
}

function writeCollapsedPref(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(value));
}

export function useResponsiveSidebar(
  options: UseResponsiveSidebarOptions = {}
): ResponsiveSidebarState {
  const { initialOpen = false, storageKey } = options;
  const collapsedKey = storageKey
    ? `${SIDEBAR_COLLAPSED_KEY}:${storageKey}`
    : SIDEBAR_COLLAPSED_KEY;
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return false;
    }
    return window.matchMedia(DESKTOP_QUERY).matches;
  });
  const [menuOpen, setMenuOpen] = useState<boolean>(initialOpen);
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsedPref(collapsedKey));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return;
    }

    const mediaQueryList = window.matchMedia(DESKTOP_QUERY);
    const updateFromQuery = (desktop: boolean) => {
      setIsDesktop(desktop);
      if (desktop) {
        setMenuOpen(true);
        setCollapsed(readCollapsedPref(collapsedKey));
      } else {
        setMenuOpen(false);
        setCollapsed(false);
      }
    };

    updateFromQuery(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => updateFromQuery(event.matches);
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [collapsedKey]);

  const toggleMobile = useCallback(() => {
    if (isDesktop) return;
    setMenuOpen((prev) => !prev);
  }, [isDesktop]);

  const closeMobile = useCallback(() => {
    if (isDesktop) return;
    setMenuOpen(false);
  }, [isDesktop]);

  const toggleCollapsed = useCallback(() => {
    if (!isDesktop) return;
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedPref(collapsedKey, next);
      return next;
    });
  }, [collapsedKey, isDesktop]);

  const isOpen = useMemo(() => (isDesktop ? true : menuOpen), [isDesktop, menuOpen]);
  const shouldShowOverlay = !isDesktop && isOpen;

  return {
    isOpen,
    isDesktop,
    toggleMobile,
    closeMobile,
    shouldShowOverlay,
    collapsed,
    toggleCollapsed
  };
}

export default useResponsiveSidebar;
