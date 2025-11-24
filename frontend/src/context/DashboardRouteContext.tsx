import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface DashboardRouteMeta {
  title: string;
  description?: string;
}

interface DashboardRouteContextValue extends DashboardRouteMeta {
  titleId: string;
  setMeta: (meta: DashboardRouteMeta) => void;
  resetMeta: () => void;
}

const DashboardRouteContext = createContext<DashboardRouteContextValue | null>(null);

export interface DashboardRouteProviderProps {
  defaultTitle?: string;
  defaultDescription?: string;
  children: ReactNode;
}

export function DashboardRouteProvider({
  defaultTitle = '',
  defaultDescription = '',
  children,
}: DashboardRouteProviderProps) {
  const defaultMetaRef = useRef<DashboardRouteMeta>({
    title: defaultTitle,
    description: defaultDescription,
  });

  const [meta, setMeta] = useState<DashboardRouteMeta>(defaultMetaRef.current);
  const titleId = useId();

  useEffect(() => {
    const nextDefault = {
      title: defaultTitle ?? '',
      description: defaultDescription ?? '',
    };
    const previousDefault = defaultMetaRef.current;
    defaultMetaRef.current = nextDefault;

    setMeta((current) => {
      if (!current.title || current.title === previousDefault.title) {
        return nextDefault;
      }
      return current;
    });
  }, [defaultTitle, defaultDescription]);

  const setRouteMeta = useCallback((next: DashboardRouteMeta) => {
    setMeta((current) => ({
      title: next.title ?? current.title,
      description: next.description ?? current.description,
    }));
  }, []);

  const resetRouteMeta = useCallback(() => {
    setMeta(defaultMetaRef.current);
  }, []);

  const value = useMemo<DashboardRouteContextValue>(
    () => ({
      titleId,
      title: meta.title,
      description: meta.description,
      setMeta: setRouteMeta,
      resetMeta: resetRouteMeta,
    }),
    [meta.description, meta.title, resetRouteMeta, setRouteMeta, titleId]
  );

  return <DashboardRouteContext.Provider value={value}>{children}</DashboardRouteContext.Provider>;
}

export function useDashboardRouteContext(): DashboardRouteContextValue {
  const context = useContext(DashboardRouteContext);
  if (!context) {
    throw new Error('useDashboardRouteContext must be used within a DashboardRouteProvider');
  }
  return context;
}

export function useDashboardRouteMeta(): DashboardRouteContextValue {
  return useDashboardRouteContext();
}
