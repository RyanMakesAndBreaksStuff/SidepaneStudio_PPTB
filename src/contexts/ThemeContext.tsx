import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextValue {
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: true });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The PPTB host owns the theme. This tool mirrors it and never sets it.
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

    // ToolBoxEvent has no dedicated theme event (see @pptb/types toolboxAPI.d.ts);
    // a host theme change surfaces as settings:updated.
    const handleToolboxEvent = (_event: unknown, payload?: ToolBoxAPI.ToolBoxEventPayload) => {
      try {
        if (payload?.event === 'settings:updated') refreshTheme();
      } catch (error) {
        console.error('ThemeProvider: failed to handle toolbox event', error);
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
    <ThemeContext.Provider value={{ isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { ThemeContext };
