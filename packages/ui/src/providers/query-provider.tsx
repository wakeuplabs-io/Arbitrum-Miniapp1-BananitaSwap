import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Consider data fresh for 2 minutes to prevent unnecessary refetches
      staleTime: 2 * 60 * 1000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus in development (reduces duplicate calls)
      refetchOnWindowFocus: process.env.NODE_ENV === "production",
      // Retry failed requests once
      retry: 1,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
