import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./ThemeContext.shared";

const STORAGE_KEY = "viisync-theme";

function resolveInitialTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}