import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/components/LoginPage";
import ResponsiveContainer from "../components/layout/ResponsiveContainer";
import RecommendationList from "../features/recommendation/components/RecommendationList";
import MapView from "../features/map/components/MapView"
import TurnByTurn from "../features/navigation/components/TurnByTurn";
import RouteDisplay from "../features/navigation/components/RouteDisplay";
import ETAIndicator from "../features/navigation/components/ETAIndicator";
import RememberParkingSpotModal from "../features/navigation/components/RememberParkingSpotModal";
import SettingsModal from "../features/profile/components/SettingsModal";
import SuggestSpotModal from "../features/parking/components/SuggestSpotModal";
import AdminRoute from "../features/admin/components/AdminRoute";
import AdminDashboard from "../features/admin/components/AdminDashboard";
import AdminErrorBoundary from "../features/admin/components/AdminErrorBoundary";
import { useUIStore } from "../store/uiStore";
import { useActiveNavigation } from "../features/navigation/hooks/useActiveNavigation";
import { initializeParkingReminderScheduler } from "../features/navigation/services/parkingReminderScheduler";

function AppShell() {
  const darkMode = useUIStore((s) => s.darkMode)

  // Enable active navigation tracking (real-time updates, step advancement, auto-end)
  useActiveNavigation()

  // Sync dark mode preference to <html> data-theme attribute
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
    }
  }, [darkMode])

  // Restore any pending parking reminder timeout after reload.
  useEffect(() => {
    void initializeParkingReminderScheduler()
  }, [])

  return (
    <>
      <ResponsiveContainer
        mapContent={<MapView />}
        spotResults={<RecommendationList />}
      />
      {/* Navigation overlay - fixed positioned, returns null when not navigating */}
      <TurnByTurn />
      <RouteDisplay />
      <RememberParkingSpotModal />
      {/* ETAIndicator: fetches OSRM route + watches GPS when navigation is active */}
      <ETAIndicator />
      {/* Settings modal - globally mounted so it works on both layouts */}
      <SettingsModal />
      {/* Suggest a Spot modal - globally mounted */}
      <SuggestSpotModal />
    </>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected - requires sign-in or guest mode */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />

        {/* Admin - requires is_admin */}
        <Route
          path="/admin"
          element={
            <AdminErrorBoundary>
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            </AdminErrorBoundary>
          }
        />

        {/* Any unknown path redirects to "/" */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
