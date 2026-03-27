import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import SearchBar from "../../features/search/components/SearchBar";
import EventList from "../../features/events/components/EventList";
import SearchResults from "../../features/search/components/SearchResults";
import { useDebouncedSearch } from "../../features/search/hooks/useDebouncedSearch";
import type { CampusEvent } from "../../types/campus_event.types";
import type { SpotFilters, ParkingType } from "../../types/parking.types";

interface SidebarProps {
  children: React.ReactNode;
  onSettingsClick: () => void;
  onSuggestSpotClick: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

// Filter chip options — values match backend exactly
const PARKING_TYPE_FILTERS: { label: string; value: ParkingType | "All"; icon: string | null }[] = [
  { label: "All",     value: "All",             icon: null },
  { label: "Garage",  value: "Parking Garage",  icon: "bi-building" },
  { label: "Surface", value: "Surface Lot",     icon: "bi-tree" },
  { label: "Street",  value: "Street Parking",  icon: "bi-signpost-fill" },
]

// Icon-only rail shown when sidebar is collapsed (D3)
function CollapsedRail({
  onToggleCollapse,
  onSettingsClick,
  setActiveTab,
  isGuest,
}: {
  onToggleCollapse: () => void;
  onSettingsClick: () => void;
  setActiveTab: (tab: "spots" | "events") => void;
  isGuest: boolean;
}) {
  const railItems = [
    { icon: "bi-p-square-fill",      label: "Spots",    onClick: () => { setActiveTab("spots"); onToggleCollapse(); } },
    ...(!isGuest ? [{ icon: "bi-calendar-event-fill", label: "Events", onClick: () => { setActiveTab("events"); onToggleCollapse(); } }] : []),
    { icon: "bi-gear-fill",           label: "Settings", onClick: onSettingsClick },
    { icon: "bi-person-circle",       label: "Profile",  onClick: onSettingsClick },
  ]

  return (
    <div className="w-[52px] flex-shrink-0 h-screen bg-white/85 backdrop-blur-xl border-r border-black/10 flex flex-col items-center pt-3 pb-4 gap-1 overflow-hidden">
      {/* Re-expand button */}
      <button
        onClick={onToggleCollapse}
        title="Expand sidebar"
        className="w-10 h-10 flex items-center justify-center hover:bg-maroon-light rounded-[10px] transition-colors duration-150 mb-1"
      >
        <i className="bi bi-layout-sidebar text-text2 text-lg" />
      </button>
      <div className="w-6 h-px bg-black/10 mb-1" />
      {railItems.map(({ icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          title={label}
          className="w-10 h-10 flex items-center justify-center hover:bg-maroon-light rounded-[10px] transition-colors duration-150"
        >
          <i className={`bi ${icon} text-text2 text-base`} />
        </button>
      ))}
    </div>
  )
}

export default function Sidebar({
  children,
  onSettingsClick,
  onSuggestSpotClick,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const navigate = useNavigate();
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const mapInstance = useUIStore((s) => s.mapInstance);

  const verifiedOnly = useUIStore((s) => s.verifiedOnly);
  const directionsOnly = useUIStore((s) => s.directionsOnly);
  const [filters, setFilters] = useState<SpotFilters>({});

  // Merge verifiedOnly global pref into filters so the API receives it
  const mergedFilters: SpotFilters = { ...filters, verified_only: verifiedOnly || undefined };
  const { data: filterResults, isLoading: filterLoading } = useDebouncedSearch(mergedFilters);

  const hasActiveFilters =
    !!filters.parking_type ||
    (filters.max_cost !== undefined && filters.max_cost < 20) ||
    !!verifiedOnly ||
    !!directionsOnly;

  const resetFilters = () => setFilters({});

  // Dynamic max cost — compute from current filter results, fallback to 20
  const maxCostInData = filterResults && filterResults.length > 0
    ? Math.ceil(Math.max(...filterResults.map((s) => s.cost ?? 0)))
    : 20
  const sliderMax = Math.max(maxCostInData, 20)

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : null;

  const handleEventMapClick = (event: CampusEvent) => {
    if (!mapInstance || event.longitude == null || event.latitude == null) return;
    mapInstance.flyTo({
      center: [event.longitude, event.latitude],
      zoom: 16,
      duration: 800,
    });
  };

  const activeTypeFilter = filters.parking_type ?? "All"

  const toggleType = (value: ParkingType | "All") => {
    setFilters((prev) => ({
      ...prev,
      parking_type: value === "All" ? undefined : value,
    }))
  }

  // Show icon rail when collapsed
  if (isCollapsed) {
    return (
      <CollapsedRail
        onToggleCollapse={onToggleCollapse}
        onSettingsClick={onSettingsClick}
        setActiveTab={setActiveTab}
        isGuest={isGuest}
      />
    )
  }

  return (
    <div className="w-[340px] flex-shrink-0 bg-white/85 backdrop-blur-xl border-r border-black/10 flex flex-col overflow-hidden h-screen">

      {/* ── LOGO ROW ── (D2) */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-black/8 flex-shrink-0">
        <div className="flex items-center gap-0.5">
          <span className="text-[15px] font-black text-maroon">Park</span>
          <span className="text-[15px] font-black text-gold mx-0.5">&amp;</span>
          <span className="text-[15px] font-black text-maroon">Go</span>
        </div>
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-maroon-light transition-colors duration-150"
        >
          <i className="bi bi-layout-sidebar text-text2 text-base" />
        </button>
      </div>

      {/* ── SEARCH + USER ROW ── (D2) */}
      <div className="px-3.5 pb-2.5 pt-2.5 border-b border-black/8 flex-shrink-0">
        {/* Search bar */}
        <div className="mb-2.5">
          <SearchBar />
        </div>

        {/* User row: avatar + name/email + gear */}
        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/60 rounded-[10px] hover:bg-maroon-light transition-colors duration-150 cursor-pointer" onClick={onSettingsClick}>
          {/* Avatar */}
          <div className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
            user ? "bg-maroon" : "bg-bg2"
          )}>
            {user?.profile_pic
              ? <img src={user.profile_pic} className="w-full h-full object-cover" alt="" />
              : user
                ? <span className="text-white text-[10px] font-bold">{initials}</span>
                : <i className="bi bi-person text-text2 text-sm" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-text1 truncate">
              {user ? (user.prefered_name || user.first_name) : "Guest"}
            </div>
            <div className="text-[10px] text-text2 truncate">
              {user ? user.email : "Guest"}
            </div>
          </div>
          <i className="bi bi-gear-fill text-text2 text-sm hover:text-maroon transition-colors flex-shrink-0" />
        </div>
      </div>

      {/* ── PARKING TYPE FILTER PILLS ── (D4) */}
      {activeTab === "spots" && (
        <div className="px-3.5 py-2 flex gap-1.5 overflow-x-auto border-b border-black/6 scrollbar-none flex-shrink-0 items-center">
          {PARKING_TYPE_FILTERS.map(({ label, value, icon }) => (
            <button
              key={value}
              onClick={() => toggleType(value)}
              className={clsx(
                "flex-shrink-0 flex items-center gap-1",
                activeTypeFilter === value ? "chip chip-ac" : "chip"
              )}
            >
              {icon && <i className={`bi ${icon} text-[10px]`} />}
              {label}
            </button>
          ))}
          {/* Reset button — only when filters are active */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex-shrink-0 flex items-center gap-1 chip border-maroon/50 text-maroon ml-auto hover:bg-maroon-light"
              title="Reset all filters"
            >
              <i className="bi bi-x-circle text-[10px]" />
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── COST SLIDER ── (D5) */}
      {activeTab === "spots" && (
        <div className="px-3.5 py-2.5 border-b border-black/6 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-semibold text-text2 uppercase tracking-wider">
              MAX COST / HR
            </div>
            <div className="text-xs font-bold text-maroon">
              {(filters.max_cost ?? sliderMax) >= sliderMax ? "Any" : `$${filters.max_cost?.toFixed(2)}/hr`}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={sliderMax}
            step={0.5}
            value={filters.max_cost ?? sliderMax}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, max_cost: Number(e.target.value) }))
            }
            style={{ accentColor: "#7A0019" }}
            className="w-full"
          />
        </div>
      )}

      {/* ── TAB SWITCHER ── (D6) */}
      <div className="flex border-b border-black/6 flex-shrink-0 relative">
        <button
          onClick={() => setActiveTab("spots")}
          className={clsx(
            "flex-1 py-2 text-xs font-semibold text-center border-b-2 -mb-px cursor-pointer transition-colors duration-150",
            activeTab === "spots" ? "text-maroon border-maroon" : "text-text3 border-transparent"
          )}
        >
          <i className="bi bi-p-square-fill mr-1" />
          Spots
        </button>
        {!isGuest && (
          <button
            onClick={() => setActiveTab("events")}
            className={clsx(
              "flex-1 py-2 text-xs font-semibold text-center border-b-2 -mb-px cursor-pointer transition-colors duration-150",
              activeTab === "events" ? "text-maroon border-maroon" : "text-text3 border-transparent"
            )}
          >
            <i className="bi bi-calendar-event-fill mr-1" />
            Events
          </button>
        )}
      </div>

      {/* ── SPOT COUNT ROW — always visible on spots tab ── */}
      {activeTab === "spots" && (filterResults?.length ?? 0) > 0 && (
        <div className="px-3.5 py-1.5 flex items-center gap-2 border-b border-black/5 flex-shrink-0">
          <span className="text-[11px] font-semibold text-text1">Filtered spots</span>
          <span className="text-[10px] font-medium text-text1 bg-bg2 rounded-full px-2 py-0.5 ml-auto">
            {(filterResults ?? []).length} spots
          </span>
          {verifiedOnly && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-maroon bg-maroon-light rounded-full px-1.5 py-0.5">
              <i className="bi bi-patch-check-fill" />
            </span>
          )}
          {directionsOnly && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-maroon bg-maroon-light rounded-full px-1.5 py-0.5">
              <i className="bi bi-sign-turn-right-fill" />
            </span>
          )}
        </div>
      )}

      {/* ── RESULTS BODY (scrollable) ── (D7) */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {activeTab === "events" && !isGuest
          ? <EventList onEventMapClick={handleEventMapClick} />
          : hasActiveFilters
            ? <SearchResults spots={filterResults} isLoading={filterLoading} query="" onReset={resetFilters} />
            : children
        }
      </div>

      {/* ── FOOTER: Suggest a Spot + Admin link ── (D8) */}
      {activeTab === "spots" && (
        <div className="p-2.5 border-t border-black/8 flex-shrink-0 space-y-2">
          {!isGuest && (
            <button
              onClick={onSuggestSpotClick}
              className="w-full flex items-center gap-2 px-2.5 py-2.5 rounded-[10px] bg-maroon hover:bg-maroon-hover transition-all duration-150 cursor-pointer"
            >
              <div className="w-7 h-7 bg-white/20 rounded-[7px] flex items-center justify-center flex-shrink-0">
                <i className="bi bi-plus-lg text-white text-sm" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-white">
                  Suggest a Parking Spot
                </div>
                <div className="text-[10px] text-white/70 mt-0.5">
                  Help fellow students find parking
                </div>
              </div>
            </button>
          )}

          {user?.is_admin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[10px] bg-maroon text-white hover:bg-maroon-hover transition-colors duration-150 cursor-pointer"
            >
              <i className="bi bi-shield-lock-fill text-sm" />
              <span className="text-xs font-semibold">Admin Dashboard</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
