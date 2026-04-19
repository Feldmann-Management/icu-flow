"use client";

import { I18nProvider } from "@lingui/react";
import { useMemo } from "react";

import { initI18n } from "@/lib/i18n";

export function LinguiProvider({ children }: { children: React.ReactNode }) {
  const i18n = useMemo(() => initI18n("en"), []);
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
