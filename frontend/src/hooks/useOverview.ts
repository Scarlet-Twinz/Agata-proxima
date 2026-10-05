import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { OverviewData } from "../types/console";

export function useOverview() {
  return useQuery<OverviewData>({
    queryKey: ["console", "overview"],
    queryFn: () => api.get<OverviewData>("/api/v1/control-plane/overview"),
    staleTime: 15_000,
    retry: 1,
  });
}
