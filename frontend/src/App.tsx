import { lazy, Suspense, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getCampusAccess } from "./lib/session";
import { Feed } from "./pages/Feed";
import { Welcome } from "./pages/Welcome";

const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const ConfessionDetails = lazy(() =>
  import("./pages/ConfessionDetails").then((m) => ({ default: m.ConfessionDetails })),
);
const CreateConfession = lazy(() =>
  import("./pages/CreateConfession").then((m) => ({ default: m.CreateConfession })),
);
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
const Report = lazy(() => import("./pages/Report").then((m) => ({ default: m.Report })));
const Saved = lazy(() => import("./pages/Saved").then((m) => ({ default: m.Saved })));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-full border border-white bg-white/90 px-5 py-2.5 text-sm font-bold text-ink shadow-card">
        Loading UNSAID...
      </div>
    </div>
  );
}

function RequireCampus({ children }: { children: ReactNode }) {
  const access = getCampusAccess();
  if (!access) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function App() {
  const [, setAuthTick] = useState(0);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/"
            element={<Welcome onSuccess={() => setAuthTick((n) => n + 1)} />}
          />
          <Route
            path="/feed"
            element={
              <RequireCampus>
                <Feed mode="campus" defaultSort="latest" />
              </RequireCampus>
            }
          />
          <Route
            path="/explore"
            element={
              <RequireCampus>
                <Feed mode="explore" defaultSort="trending" />
              </RequireCampus>
            }
          />
          <Route
            path="/create"
            element={
              <RequireCampus>
                <CreateConfession />
              </RequireCampus>
            }
          />
          <Route
            path="/confession/:id"
            element={
              <RequireCampus>
                <ConfessionDetails />
              </RequireCampus>
            }
          />
          <Route
            path="/report/:targetType/:targetId"
            element={
              <RequireCampus>
                <Report />
              </RequireCampus>
            }
          />
          <Route
            path="/saved"
            element={
              <RequireCampus>
                <Saved />
              </RequireCampus>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireCampus>
                <Profile />
              </RequireCampus>
            }
          />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
