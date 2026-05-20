import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import Providers from "./app/providers"
import AdminDashboard from "./features/admin/components/AdminDashboard"
import AdminRoute from "./features/admin/components/AdminRoute"
import AdminErrorBoundary from "./features/admin/components/AdminErrorBoundary"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <AdminErrorBoundary>
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      </AdminErrorBoundary>
    </Providers>
  </StrictMode>
)
