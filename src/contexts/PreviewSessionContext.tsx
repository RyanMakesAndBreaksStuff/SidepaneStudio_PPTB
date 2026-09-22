import * as React from 'react';

type Session = Map<string, unknown>;
const PreviewSessionContext = React.createContext<Session | null>(null);

export function PreviewSessionProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const values = React.useRef<Session>(new Map());
  return <PreviewSessionContext.Provider value={values.current}>{children}</PreviewSessionContext.Provider>;
}

export function PreviewSessionBoundary({ children }: { children: React.ReactNode }): React.ReactElement {
  const existing = React.useContext(PreviewSessionContext);
  return existing ? <>{children}</> : <PreviewSessionProvider>{children}</PreviewSessionProvider>;
}

export function usePreviewSessionState<T>(
  key: string,
  initial: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const shared = React.useContext(PreviewSessionContext);
  const local = React.useRef<Session>(new Map());
  const session = shared ?? local.current;
  const read = (): T => {
    if (!session.has(key)) session.set(key, typeof initial === 'function' ? (initial as () => T)() : initial);
    return session.get(key) as T;
  };
  const [value, update] = React.useState<T>(read);
  const setter = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(next => {
    const previous = session.get(key) as T;
    const result = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
    session.set(key, result);
    update(result);
  }, [session, key]);
  return [value, setter];
}
