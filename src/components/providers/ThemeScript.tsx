"use client";

import { useEffect } from "react";

/**
 * Keeps `.dark` on <html> in sync with prefers-color-scheme / localStorage.
 * Pair with the blocking inline script in root layout to avoid a flash.
 */
export function ThemeScript() {
  useEffect(() => {
    const root = document.documentElement;
    const readStored = () => {
      try {
        return localStorage.getItem("sealsend_theme");
      } catch {
        return null;
      }
    };

    const apply = (mode: string | null) => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = mode === "dark" || (mode !== "light" && prefersDark);
      root.classList.toggle("dark", dark);
      root.style.colorScheme = dark ? "dark" : "light";
    };

    apply(readStored());

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = readStored();
      if (!current || current === "system") apply(current);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return null;
}
