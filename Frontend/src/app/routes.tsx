import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/components/LoginPage";
import ResponsiveContainer from "../components/layout/ResponsiveContainer";
import RecommendationList from "../features/recommendation/components/RecommendationList";
import MapView from "../features/map/components/MapView"
import { useAuthStore } from "../store/authStore";
import { getMe } from "../features/auth/services/authApi";

function AppShell() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

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

  return (
    <ResponsiveContainer
      mapContent={<MapView />}
      spotResults={<RecommendationList />}
    />
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

        {/* Any unknown path redirects to "/" */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
