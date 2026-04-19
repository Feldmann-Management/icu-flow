import { i18n } from "@lingui/core";
import { messages as enMessages } from "../locales/en/messages";

export function initI18n(locale: string = "en") {
  i18n.load(locale, locale === "en" ? enMessages : enMessages);
  i18n.activate(locale);
  return i18n;
}

export { i18n };
