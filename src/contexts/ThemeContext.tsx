import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

type ToolboxThemeEventPayload = {
  event?: string;
};

interface ThemeContextValue {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: true, setIsDark: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState] = useState<boolean>(true); // dark default until host responds

  useEffect(() => {
    const toolbox = window.toolboxAPI;
    let active = true;

    const refreshTheme = () => {
      toolbox?.utils?.getCurrentTheme()
        .then((hostTheme) => {
          if (active) setIsDarkState(hostTheme === 'dark');
        })
        .catch(() => {
          // Keep the current theme if the host cannot answer during startup or shutdown.
        });
    };

    const handleToolboxEvent = (event: string, payload?: ToolboxThemeEventPayload) => {
      const eventName = payload?.event ?? event;
      if (eventName === 'settings:updated' || eventName === 'theme:changed') {
        refreshTheme();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshTheme();
    };

    refreshTheme();
    toolbox?.events?.on(handleToolboxEvent);
    window.addEventListener('focus', refreshTheme);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      toolbox?.events?.off(handleToolboxEvent);
      window.removeEventListener('focus', refreshTheme);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark: setIsDarkState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { ThemeContext };
