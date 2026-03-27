import { useNavigate } from "react-router-dom"
import StatsOverview from "./StatsOverview"
import SpotManagement from "./SpotManagement"
import EventSyncPanel from "./EventSyncPanel"
import ConfigPanel from "./ConfigPanel"

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-text1">
      {/* Header */}
      <header className="bg-maroon text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-50 shadow-md">
        <button
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <i className="bi bi-arrow-left" />
        </button>
        <div>
          <h1 className="text-base font-bold">Admin Dashboard</h1>
          <p className="text-[10px] text-white/70">Park & Go Management</p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <StatsOverview />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SpotManagement />
          <div className="space-y-5">
            <EventSyncPanel />
            <ConfigPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
