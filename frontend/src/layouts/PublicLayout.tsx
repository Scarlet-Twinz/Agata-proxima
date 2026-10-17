import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PublicNavigation } from "../components/navigation/PublicNavigation";
import { PublicFooter } from "../components/layout/PublicFooter";

export function PublicLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);
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
