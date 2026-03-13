import { useState } from "react"
import clsx from "clsx"
import type { CampusEvent } from "../../../types/campus_event.types"

// Category badge color map — define outside the component so it's not recreated on each render
const CATEGORY_STYLES: Record<string, string> = {
  Sports:          "bg-maroon-light text-maroon border-maroon/20",
  "Student Life":  "bg-gold-light text-gold-dark border-gold/30",
  Academics:       "bg-bg2 text-text2 border-border",
  STEM:            "bg-blue/10 text-blue border-blue/20",
  Arts:            "bg-[rgba(175,82,222,0.1)] text-[#af52de] border-[rgba(175,82,222,0.2)]",
}

// Which categories get the pinned (maroon border) treatment
const PINNED_CATEGORIES = ["Sports", "STEM"]

interface EventCardProps {
  event: CampusEvent
  onMapClick: (event: CampusEvent) => void// called when Map button is tapped
}

export default function EventCard({ event, onMapClick }: EventCardProps) {
  const [reminderSet, setReminderSet] = useState(false)

  // Guard against null — backend marks starts_at/ends_at as Optional[datetime]
  const startsAt = event.starts_at ? new Date(event.starts_at) : null
  const endsAt = event.ends_at ? new Date(event.ends_at) : null

  const month = startsAt?.toLocaleString("en-US", { month: "short" }).toUpperCase() ?? "—"
  const day = startsAt?.getDate() ?? "—"

  // Format time range: "2:00 PM – 4:00 PM", fallback when dates are missing
  const timeRange = startsAt && endsAt
    ? `${startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : "Time TBD"

  const isPinned = PINNED_CATEGORIES.includes(event.category)
  const badgeStyle = CATEGORY_STYLES[event.category] ?? CATEGORY_STYLES["Academics"]

  return (
    // Matches .ev-item / .ev-item.pinned
    <div
      className={clsx(
        "border-[1.5px] rounded-[10px] p-2.5 mb-2 cursor-pointer transition-all duration-200 hover:-translate-y-[1px]",
        isPinned ? "border-maroon bg-maroon-light" : "border-black/9 bg-bg"
      )}
    >

      {/* Top row — matches .ev-row */}
      <div className="flex gap-2.5 items-start mb-1.5">

        {/* Date block — matches .ev-dc */}
        <div className="w-9 h-9 bg-white rounded-[8px] border border-black/9 flex flex-col items-center justify-center flex-shrink-0">
          <span className="text-[8px] font-bold text-maroon uppercase">{month}</span>
          <span className="text-base font-black leading-none">{day}</span>
        </div>

        {/* Event info — matches .ev-inf */}
        <div className="flex-1 min-w-0">
          {/* Event name — matches .ev-nm */}
          <div className="text-[12px] font-bold leading-snug mb-0.5 truncate">
            {event.title}
          </div>
          {/* Location + time — matches .ev-meta */}
          <div className="text-[10px] text-text2">
            {event.location_name} · {timeRange}
          </div>
        </div>

        {/* Category badge — matches .ev-badge */}
        <span
          className={clsx(
            "text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0",
            badgeStyle
          )}
        >
          {event.category}
        </span>
      </div>

      {/* Action buttons — matches .ev-btns */}
      <div className="flex gap-1.5">

        {/* Map button — matches .ev-map-btn */}
        <button
          onClick={() => onMapClick(event)}
          className="flex-1 text-[10px] font-semibold text-blue bg-blue/7 border border-blue/15 rounded-[6px] py-1.5 text-center transition-transform duration-200 hover:-translate-y-[1px]"
        >
          <i className="bi bi-map mr-1" />
          Map
        </button>

        {/* Reminder button — matches .ev-rem-btn / .ev-rem-btn.set */}
        <button
          onClick={() => setReminderSet(!reminderSet)}
          className={clsx(
            "flex-1 text-[10px] font-semibold rounded-[6px] py-1.5 text-center border transition-all duration-200 hover:-translate-y-[1px]",
            reminderSet ? "bg-maroon text-white border-maroon" : "bg-maroon-light text-maroon border-maroon/20"
          )}
        >
          <i className={clsx("bi mr-1", reminderSet ? "bi-bell-fill" : "bi-bell")} />
          {reminderSet ? "Reminder Set" : "Set Reminder"}
        </button>

      </div>
    </div>
  )
}
