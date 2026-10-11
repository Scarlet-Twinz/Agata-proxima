import { useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function AppProviders({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    const invalidateOverviewAfterMutation = () => {
      void queryClient.invalidateQueries({ queryKey: ["console", "overview"] });
    };
    window.addEventListener("agata:data-changed", invalidateOverviewAfterMutation);
    return () => window.removeEventListener("agata:data-changed", invalidateOverviewAfterMutation);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
