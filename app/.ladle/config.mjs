/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: "src/**/*.stories.{ts,tsx}",
  viteConfig: ".ladle/vite.config.ts",
  addons: {
    a11y: { enabled: true },
    width: { enabled: false },
    rtl: { enabled: false },
  },
};
