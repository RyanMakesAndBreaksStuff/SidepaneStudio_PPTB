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

export interface PreviewPaneState {
  /** A preview open has created the pane in this session. */
  exists: boolean;
  /** The pane is the selected (visible) side pane. */
  selected: boolean;
}

/**
 * The simulated side pane outlives a single open, as Xrm.App.sidePanes panes do. Each open mirrors the
 * generated script: reusing an existing pane selects it only when isSelected is true, so it otherwise keeps
 * its current selection; creating it (the first open, or every open with reuse off) applies isSelected.
 * Each preview surface simulates its own host page, so each keeps its own pane.
 */
export function usePreviewPane(surface: 'form' | 'grid'): [PreviewPaneState, (isSelected: boolean, reuseExistingPane: boolean) => void] {
  const [pane, setPane] = usePreviewSessionState<PreviewPaneState>(`preview-pane:${surface}`, { exists: false, selected: false });
  const open = React.useCallback((isSelected: boolean, reuseExistingPane: boolean) => setPane(prev => ({
    exists: true,
    selected: prev.exists && reuseExistingPane && !isSelected ? prev.selected : isSelected,
  })), [setPane]);
  return [pane, open];
}
