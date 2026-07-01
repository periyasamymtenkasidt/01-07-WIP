import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { hydrateAllMasters } from "../api/bootstrapMasters";

const MainLayout = () => {
  // Refresh master config from the backend when the authenticated shell mounts
  // (covers a returning user whose token was already in localStorage). Guarded
  // and once-per-session inside hydrateAllMasters; falls back to local seed.
  useEffect(() => {
    hydrateAllMasters();
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-overallbg font-manrope">
      <header className="shrink-0 sticky top-0 z-50">
        <Header />
      </header>

      <div className="flex-1 w-full flex overflow-hidden">
        <aside className="shrink-0 h-full overflow-y-auto scroll-hidden-bar">
          <Sidebar />
        </aside>

        <main className="flex-1 h-full overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
