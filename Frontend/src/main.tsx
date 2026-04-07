import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import "maplibre-gl/dist/maplibre-gl.css" // Note: maplibre-gl's CSS import is required for the map to display correctly
import App from "./App"
import maplibregl from "maplibre-gl"

maplibregl.setMaxParallelImageRequests(16) 

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
