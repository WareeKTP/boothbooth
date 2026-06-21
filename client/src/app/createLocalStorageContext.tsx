import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Factory for small pieces of client-only UI state that persist to
 * localStorage and sync to a `document.documentElement.dataset` attribute
 * (theme, density, ...). Never round-tripped to the server — see
 * frontend-final.md §7/§8. Built once so Theme/Density don't each hand-roll
 * the same create-context/provider/hook/null-check boilerplate.
 */
export function createLocalStorageContext<T extends string>(key: string, datasetKey: string, fallback: T) {
  const Context = createContext<[T, (v: T) => void] | null>(null);

  function Provider({ children, isValid }: { children: ReactNode; isValid: (v: string) => v is T }) {
    const [value, setValue] = useState<T>(() => {
      const stored = localStorage.getItem(key);
      return stored && isValid(stored) ? stored : fallback;
    });

    useEffect(() => {
      document.documentElement.dataset[datasetKey] = value;
      localStorage.setItem(key, value);
    }, [value]);

    return <Context.Provider value={[value, setValue]}>{children}</Context.Provider>;
  }

  function useValue(): [T, (v: T) => void] {
    const ctx = useContext(Context);
    if (!ctx) throw new Error(`Context for "${key}" used outside its Provider`);
    return ctx;
  }

  return { Provider, useValue };
}
