import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useState } from "react";
import clsx from "clsx";
import SearchBar from "../../features/search/components/SearchBar";
import EventList from "../../features/events/components/EventList";
import type { CampusEvent } from "../../types/campus_event.types";

interface SidebarProps {
  children: React.ReactNode;
  onSettingsClick: () => void;
  onSuggestSpotClick: () => void;
}

export default function Sidebar({
  children,
  onSettingsClick,
  onSuggestSpotClick,
}: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const mapInstance = useUIStore((s) => s.mapInstance);
  const [activeFilter, setActiveFilter] = useState("All");
  const [maxCost, setMaxCost] = useState(20);

  const filters = ["All", "Garage", "Surface Lot", "Street"];
  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "??";

  const handleEventMapClick = (event: CampusEvent) => {
    if (!mapInstance || event.longitude == null || event.latitude == null) return;
    mapInstance.flyTo({
      center: [event.longitude, event.latitude],
      zoom: 16,
      duration: 800,
    });
  };

  return (
    <div className="w-[340px] flex-shrink-0 bg-white/85 backdrop-blur-xl border-r border-black/10 flex flex-col overflow-hidden pt-9">
      {/* -- TOP SECTION: search + user row */}
      <div className="px-3.5 pb-2.5 border-b border-black/8">
        {/* Search bar */}
        <div className="mb-2.5">
          <SearchBar />
        </div>

        {/* User row: avatar + name/email + gear */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/60 rounded-[10px]">
          <div className="w-7 h-7 rounded-full bg-maroon flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 overflow-hidden">
            {user?.profile_pic
              ? <img src={user.profile_pic} className="w-full h-full object-cover" alt="" />
              : initials
            }
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold">
              {user?.prefered_name || user?.first_name}
            </div>
            <div className="text-[10px] text-text2">{user?.email}</div>
          </div>
          <button onClick={onSettingsClick}>
            <i className="bi bi-gear-fill text-text2 text-sm" />
          </button>
        </div>
      </div>

      {/* -- FILTER PILLS -- */}
      <div className="px-3.5 py-2 flex gap-1.5 overflow-x-auto border-b border-black/6 scrollbar-none">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={clsx("flex-shrink-0", activeFilter === filter ? "chip chip-ac" : "chip")}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* -- COST SLIDER -- */}
      <div className="px-3.5 py-2.5 border-b border-black/6">
        <div className="text-[10px] font-semibold text-text2 uppercase tracking-wider mb-1.5">
          Max Cost
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={maxCost}
            onChange={(e) => setMaxCost(Number(e.target.value))}
            style={{ accentColor: "#7A0019" }}
            className="flex-1"
          />
          <div className="text-xs font-bold text-maroon whitespace-nowrap">
            {maxCost >= 20 ? "Any" : `$${maxCost}/hr`}
          </div>
        </div>
      </div>
      {/* -- TAB SWITCHER -- */}
      <div className="flex border-b border-black/6 flex-shrink-0">
        <button
          onClick={() => setActiveTab("spots")}
          className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 -mb-px cursor-pointer ${
            activeTab === "spots"
              ? "text-maroon border-maroon"
              : "text-text3 border-transparent"
          }`}
        >
          <i className="bi bi-car-front-fill mr-1" />
          Suggested Spots
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 -mb-px cursor-pointer ${
            activeTab === "events"
              ? "text-maroon border-maroon"
              : "text-text3 border-transparent"
          }`}
        >
          <i className="bi bi-calendar-event-fill mr-1" />
          Local Events
        </button>
      </div>
      {/* -- RESULTS BODY (scrollable) -- */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "events"
          ? <EventList onEventMapClick={handleEventMapClick} />
          : children
        }
      </div>

      {/* -- FOOTER: Suggest a Spot -- */}
      {activeTab === "spots" && (
        <div className="p-2.5 border-t border-black/8 flex-shrink-0">
          <button
            onClick={onSuggestSpotClick}
            className="w-full flex items-center gap-2 px-2.5 py-2.5 border-[1.5px] border-dashed border-maroon/30 rounded-[10px] bg-maroon-light transition-all duration-200 hover:-translate-y-[1px]"
          >
            <div className="w-7 h-7 bg-maroon rounded-[7px] flex items-center justify-center flex-shrink-0">
              <i className="bi bi-plus-lg text-white text-sm" />
            </div>
            <div className="text-left">
              <div className="text-xs font-semibold text-maroon">
                Suggest a Spot
              </div>
              <div className="text-[10px] text-maroon/60 mt-0.5">
                Help the community
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
