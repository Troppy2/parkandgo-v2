import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import LoginPage from "./features/auth/components/LoginPage"
import Providers from "./app/providers"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <LoginPage />
    </Providers>
  </StrictMode>
)
