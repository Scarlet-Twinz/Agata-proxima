import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PublicNavigation } from "../components/navigation/PublicNavigation";
import { PublicFooter } from "../components/layout/PublicFooter";

export function PublicLayout() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    window.scrollTo(0, 0);
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
