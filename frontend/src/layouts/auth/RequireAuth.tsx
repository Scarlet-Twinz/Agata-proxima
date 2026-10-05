import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "../../api/auth";

export function RequireAuth() {
  const location = useLocation();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 30_000,
    retry: false,
  });

  if (session.isPending) {
    return (
      <div className="auth-session-loading">
        <strong>Checking your Proxima session…</strong>
        <span>Authentication is required before the control plane can open.</span>
      </div>
    );
  }

  if (session.isError || !session.data?.authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
