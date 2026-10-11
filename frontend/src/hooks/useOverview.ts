import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { OverviewData } from "../types/console";

export function useOverview() {
  const overview = useQuery<OverviewData>({
    queryKey: ["console", "overview"],
    queryFn: () => api.get<OverviewData>("/api/v1/control-plane/overview"),
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    const refreshAfterMutation = () => {
      void overview.refetch();
    };
    window.addEventListener("agata:data-changed", refreshAfterMutation);
    return () => window.removeEventListener("agata:data-changed", refreshAfterMutation);
  }, [overview.refetch]);

  return overview;
}
