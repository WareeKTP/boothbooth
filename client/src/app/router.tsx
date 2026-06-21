import { Navigate, Route, BrowserRouter, Routes, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { useSession } from '../features/auth/useSession';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BoothsListPage } from '../features/booths/BoothsListPage';
import { BoothDetailPage } from '../features/booths/BoothDetailPage';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { RestockQueuePage } from '../features/restock/RestockQueuePage';
import { PosPage } from '../features/pos/PosPage';
import { MyBoothPage } from '../features/mybooth/MyBoothPage';
import { DailyLogPage } from '../features/dailylog/DailyLogPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function FullScreenSpinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--text-3)' }}>Loading…</div>
  );
}

/** Route guard: redirects to /login if no session, else renders children inside AppShell. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { account, isLoading, isUnauthenticated } = useSession();

  if (isLoading) return <FullScreenSpinner />;
  if (isUnauthenticated || !account) return <Navigate to="/login" replace />;

  return <AppShell>{children}</AppShell>;
}

/** Owner-only route — staff get redirected to their role home. */
function RequireOwner({ children }: { children: ReactNode }) {
  const { account } = useSession();
  if (account && account.role !== 'owner') return <Navigate to="/pos" replace />;
  return <>{children}</>;
}

/** Staff-only route — owner gets redirected to their role home. */
function RequireStaff({ children }: { children: ReactNode }) {
  const { account } = useSession();
  if (account && account.role !== 'staff') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * `/booths/:boothId` is owner + "staff viewing their own booth" per
 * frontend-final.md §2. Staff who manually edit the URL to another booth get
 * redirected to /my-booth instead of relying purely on a 403 toast — backend
 * still enforces this regardless, this is just a clean in-app fallback.
 */
function BoothDetailGuard() {
  const { account } = useSession();
  const { boothId } = useParams();

  if (account?.role === 'staff' && boothId !== account.booth?.id) {
    return <Navigate to="/my-booth" replace />;
  }
  return <BoothDetailPage />;
}

function RoleHomeRedirect() {
  const { account } = useSession();
  if (!account) return null;
  return <Navigate to={account.role === 'owner' ? '/dashboard' : '/pos'} replace />;
}

function NotFoundPage() {
  return (
    <div className="bb-screen">
      <div className="bb-empty bb-empty-lg">Page not found.</div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <RequireOwner>
                <DashboardPage />
              </RequireOwner>
            </RequireAuth>
          }
        />
        <Route
          path="/booths"
          element={
            <RequireAuth>
              <RequireOwner>
                <BoothsListPage />
              </RequireOwner>
            </RequireAuth>
          }
        />
        <Route
          path="/booths/:boothId"
          element={
            <RequireAuth>
              <BoothDetailGuard />
            </RequireAuth>
          }
        />
        <Route
          path="/warehouse"
          element={
            <RequireAuth>
              <WarehousePage />
            </RequireAuth>
          }
        />
        <Route
          path="/restock"
          element={
            <RequireAuth>
              <RequireOwner>
                <RestockQueuePage />
              </RequireOwner>
            </RequireAuth>
          }
        />

        <Route
          path="/pos"
          element={
            <RequireAuth>
              <RequireStaff>
                <PosPage />
              </RequireStaff>
            </RequireAuth>
          }
        />
        <Route
          path="/my-booth"
          element={
            <RequireAuth>
              <RequireStaff>
                <MyBoothPage />
              </RequireStaff>
            </RequireAuth>
          }
        />
        <Route
          path="/daily-log"
          element={
            <RequireAuth>
              <RequireStaff>
                <DailyLogPage />
              </RequireStaff>
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <RoleHomeRedirect />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
