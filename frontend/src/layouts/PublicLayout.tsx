import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PublicNavigation } from "../components/navigation/PublicNavigation";
import { PublicFooter } from "../components/layout/PublicFooter";

export function PublicLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <div className="public-shell">
      <PublicNavigation />

      <main>
        <Outlet />
      </main>

      <PublicFooter />
    </div>
  );
}
