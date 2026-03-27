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
import SettingsModal from "../features/profile/components/SettingsModal";
import SuggestSpotModal from "../features/parking/components/SuggestSpotModal";
import AdminRoute from "../features/admin/components/AdminRoute";
import AdminDashboard from "../features/admin/components/AdminDashboard";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { getMe } from "../features/auth/services/authApi";

function AppShell() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const darkMode = useUIStore((s) => s.darkMode)

  // On mount: if we have a token but no user object (e.g. after page reload),
  // restore the user by calling /auth/me. If the token is invalid, log out.
  useEffect(() => {
    if (isAuthenticated && !user && token) {
      const refreshToken = localStorage.getItem("refresh_token") ?? ""
      getMe()
        .then((fetchedUser) => setAuth(fetchedUser, token, refreshToken))
        .catch(() => clearAuth())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync dark mode preference to <html> data-theme attribute
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
    }
  }, [darkMode])

  return (
    <>
      <ResponsiveContainer
        mapContent={<MapView />}
        spotResults={<RecommendationList />}
      />
      {/* Navigation overlay — fixed positioned, returns null when not navigating */}
      <TurnByTurn />
      <RouteDisplay />
      {/* ETAIndicator: fetches OSRM route + watches GPS when navigation is active */}
      <ETAIndicator />
      {/* Settings modal — globally mounted so it works on both layouts */}
      <SettingsModal />
      {/* Suggest a Spot modal — globally mounted */}
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

        {/* Protected — requires sign-in or guest mode */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />

        {/* Admin — requires is_admin */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Any unknown path redirects to "/" */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
