import type { GlobalProvider } from "@ladle/react";
import { useEffect } from "react";
import "../src/styles/globals.css";
import "../src/styles/fonts";
import "../src/i18n"; // initialise react-i18next so i18n-using stories render

// Dark is canonical; stories render on the Capisco surface.
export const Provider: GlobalProvider = ({ children }) => {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <div className="bg-background p-6 text-foreground">{children}</div>;
};
