import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  setIsDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ isDark: true, setIsDark: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState] = useState<boolean>(true); // dark default until host responds

  useEffect(() => {
    window.toolboxAPI?.utils?.getCurrentTheme().then((hostTheme) => {
      setIsDarkState(hostTheme === 'dark');
    });
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
