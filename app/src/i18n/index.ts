import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

// i18n from day one (concept §5.9). English is the only active language for now;
// the layer exists so retrofitting is never needed. No hardcoded visible strings.
export const defaultNS = "translation";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  defaultNS,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
