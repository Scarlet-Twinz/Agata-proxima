import { Outlet } from "react-router-dom";
import { PublicNavigation } from "../components/navigation/PublicNavigation";
import { PublicFooter } from "../components/layout/PublicFooter";

export function PublicLayout() {
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
