import { useState } from "react"
import clsx from "clsx"
import { useEvents } from "../hooks/useEvents"
import EventCard from "./EventCard"
import Skeleton from "../../../components/ui/Skeleton"
import type { CampusEvent, EventCategory } from "../../../types/campus_event.types"

// All 5 categories — must match backend exactly
const CATEGORIES: EventCategory[] = [
    "Sports", "Student Life", "Academics", "STEM", "Arts"
]

interface EventListProps {
    onEventMapClick: (event: CampusEvent) => void
}

export default function EventList({ onEventMapClick }: EventListProps) {
    // null = show all categories
    const [activeCategory, setActiveCategory] = useState<EventCategory | undefined>(undefined)

    const { data: events, isLoading, isError } = useEvents(activeCategory)

    return (
        <div>
            {/* Category filter chips — matches .ev-cats */}
            {/* Horizontally scrollable, no scrollbar visible */}
            <div className="flex gap-1.5 px-3.5 py-2 overflow-x-auto scrollbar-none border-b border-black/9">

                {/* "All" chip — active when no category is selected */}
                <button
                    onClick={() => setActiveCategory(undefined)}
                    className={clsx(
                        "flex-shrink-0",
                        activeCategory === undefined ? "chip chip-ac" : "chip"
                    )}
                >
                    All
                </button>

                {CATEGORIES.map((category) => (
                    <button
                        key={category}
                        onClick={() => setActiveCategory(activeCategory === category ? undefined : category)}
                        className={clsx(
                            "flex-shrink-0",
                            activeCategory === category ? "chip chip-ac" : "chip"
                        )}
                    >
                        {category}
                    </button>
                ))}
            </div>

            {/* List body */}
            <div className="overflow-y-auto max-h-[280px] px-3.5 pt-1.5 pb-3.5 scrollbar-none">

                {isLoading && (
                    <div className="space-y-2 pt-1">
                        <Skeleton className="h-24 rounded-[10px]" />
                        <Skeleton className="h-24 rounded-[10px]" />
                        <Skeleton className="h-24 rounded-[10px]" />
                    </div>
                )}

                {isError && (
                    <div className="py-6 text-center text-[12px] text-text2">
                        Couldn't load events. Check back soon.
                    </div>
                )}

                {!isLoading && !isError && events?.length === 0 && (
                    <div className="py-6 text-center">
                        <div className="text-[13px] font-semibold text-text1 mb-1">
                            No upcoming events
                        </div>
                        <div className="text-[11px] text-text2">
                            {activeCategory
                                ? `No ${activeCategory} events right now`
                                : "Check back closer to game days and campus events"}
                        </div>
                    </div>
                )}

                {!isLoading && events?.map((event) => (
                    <EventCard
                        key={event.event_id}
                        event={event}
                        onMapClick={onEventMapClick}
                    />
                ))}

            </div>
        </div>
    )
}
