"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { LinguiProvider } from "./i18n-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <LinguiProvider>{children}</LinguiProvider>
    </QueryClientProvider>
  );
}
