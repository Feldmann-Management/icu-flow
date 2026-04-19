import type { LinguiConfig } from "@lingui/conf";

const config: LinguiConfig = {
  locales: ["en"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/locales/{locale}/messages",
      include: ["<rootDir>/app", "<rootDir>/components", "<rootDir>/lib"],
    },
  ],
  format: "po",
};

export default config;
