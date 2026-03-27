import { useAdminStats } from "../hooks/useAdmin"
import { Skeleton } from "@/components/ui"

export default function StatsOverview() {
  const { data: stats, isLoading, error } = useAdminStats()

  if (isLoading) return <Skeleton className="h-24" />
  if (error || !stats) return <div className="text-red-500 text-sm">Failed to load stats</div>

  const cards = [
    { label: "Total Spots", value: stats.total_spots, icon: "bi-pin-map-fill", color: "text-maroon" },
    { label: "Verified", value: stats.verified_spots, icon: "bi-patch-check-fill", color: "text-green-600" },
    { label: "Pending Review", value: stats.unverified_spots, icon: "bi-clock-fill", color: "text-amber-500" },
    { label: "Users", value: stats.total_users, icon: "bi-people-fill", color: "text-blue-600" },
    { label: "Events", value: stats.total_events, icon: "bi-calendar-event-fill", color: "text-purple-600" },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-black/[0.12] p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <i className={`bi ${c.icon} ${c.color}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text1">{c.label}</span>
          </div>
          <div className="text-2xl font-bold text-text1">{c.value}</div>
        </div>
      ))}
    </div>
  )
}
