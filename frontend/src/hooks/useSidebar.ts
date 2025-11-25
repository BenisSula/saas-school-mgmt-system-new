/**
 * Consolidated sidebar hook
 * Combines Zustand store with responsive behavior
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore } from '../lib/store/uiStore';

const DESKTOP_QUERY = '(min-width: 1024px)';

export interface UseSidebarOptions {
  initialOpen?: boolean;
  storageKey?: string;
}

export interface UseSidebarReturn {
  isOpen: boolean;
  isDesktop: boolean;
  collapsed: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  shouldShowOverlay: boolean;
}

export function useSidebar(options: UseSidebarOptions = {}): UseSidebarReturn {
  const { initialOpen = false, storageKey } = options;
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    toggleMobileSidebar,
  } = useUIStore();
  const prevStorageKeyRef = useRef<string | undefined>(storageKey);
  const prevCollapsedRef = useRef(sidebarCollapsed);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);

  useEffect(() => {
    sidebarCollapsedRef.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  // Handle per-user storage key if provided - only on mount or storageKey change
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;

    // Reset initialization when storageKey changes
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
    }

    const storageKeyName = `saas-sidebar-collapsed:${storageKey}`;
    const stored = window.localStorage.getItem(storageKeyName);

    if (stored !== null) {
      const isCollapsed = stored === 'true';
      if (isCollapsed !== sidebarCollapsedRef.current) {
        setSidebarCollapsed(isCollapsed);
        prevCollapsedRef.current = isCollapsed;
      }
    } else if (sidebarCollapsedRef.current) {
      // No stored preference for this user, default to expanded state
      setSidebarCollapsed(false);
      prevCollapsedRef.current = false;
    }
  }, [storageKey, setSidebarCollapsed]);

  // Persist to user-specific key when collapsed state changes
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    if (prevCollapsedRef.current === sidebarCollapsed) return;

    const storageKeyName = `saas-sidebar-collapsed:${storageKey}`;
    window.localStorage.setItem(storageKeyName, String(sidebarCollapsed));
    prevCollapsedRef.current = sidebarCollapsed;
  }, [storageKey, sidebarCollapsed]);

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
      if (desktop) {
        setMenuOpen(true);
      } else {
        // Auto-collapse on mobile
        setMenuOpen(false);
        setSidebarCollapsed(false);
        setMobileSidebarOpen(false);
      }
    };

    updateFromQuery(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => updateFromQuery(event.matches);
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [setSidebarCollapsed, setMobileSidebarOpen]);

  const toggleMobile = useCallback(() => {
    if (isDesktop) return;
    toggleMobileSidebar();
  }, [isDesktop, toggleMobileSidebar]);

  const closeMobile = useCallback(() => {
    if (isDesktop) return;
    setMobileSidebarOpen(false);
  }, [isDesktop, setMobileSidebarOpen]);

  const toggleCollapsed = useCallback(() => {
    if (!isDesktop) return;
    toggleSidebarCollapsed();
  }, [isDesktop, toggleSidebarCollapsed]);

  const setCollapsed = useCallback(
    (collapsed: boolean) => {
      if (!isDesktop) return;
      setSidebarCollapsed(collapsed);
      // Persist to user-specific key if provided
      if (storageKey && typeof window !== 'undefined') {
        const storageKeyName = `saas-sidebar-collapsed:${storageKey}`;
        window.localStorage.setItem(storageKeyName, String(collapsed));
        prevCollapsedRef.current = collapsed;
      }
    },
    [isDesktop, setSidebarCollapsed, storageKey]
  );

  const isOpen = useMemo(() => {
    if (isDesktop) return true;
    return mobileSidebarOpen || menuOpen;
  }, [isDesktop, mobileSidebarOpen, menuOpen]);

  const shouldShowOverlay = !isDesktop && isOpen;
  const collapsed = isDesktop ? sidebarCollapsed : false;

  return {
    isOpen,
    isDesktop,
    collapsed,
    toggleMobile,
    closeMobile,
    toggleCollapsed,
    setCollapsed,
    shouldShowOverlay,
  };
}
