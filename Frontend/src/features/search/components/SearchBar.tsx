import { useState } from "react";
import { useSearch } from "../hooks/useSearch";
import { useCampusBuildingSearch } from "../../campus/hooks/useCampusBuildings";
import { buildingToParkingSpot } from "../../campus/utils/buildingMappers";
import { useNavStore } from "../../../store/navStore";
import { useUIStore } from "../../../store/uiStore";
import { logContextEvent } from "../../navigation/services/navigationApi";
import type { CampusBuilding } from "../../../types/campus_building.types";

interface SearchBarProps {
  onSettingsClick?: () => void;
}

// Both sections are sliced to the same small number so neither can push the
// other off a phone screen. Matches the TOP_N the campus list already uses.
const SECTION_LIMIT = 5;

export default function SearchBar({ onSettingsClick }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { data: spotResults, isLoading: spotsLoading } = useSearch(query);
  const { data: buildingResults, isLoading: buildingsLoading } =
    useCampusBuildingSearch(query);
  const startNavigation = useNavStore((s) => s.startNavigation);
  const setTravelMode = useNavStore((s) => s.setTravelMode);
  const appMode = useUIStore((s) => s.appMode);

  const showResults = isFocused && query.length >= 2;
  const isLoading = spotsLoading || buildingsLoading;

  const spots = (spotResults ?? []).slice(0, SECTION_LIMIT);
  const buildings = (buildingResults ?? []).slice(0, SECTION_LIMIT);
  const isEmpty = spots.length === 0 && buildings.length === 0;

  // Picking a building starts directions, the same as picking a parking spot.
  // The travel mode is the only difference: a building is somewhere you walk
  // into, in either app mode. Setting the mode before startNavigation means the
  // first OSRM request already asks for the foot profile, so no driving route
  // is fetched and thrown away. Same order as CampusBuildingCard.handleWalkHere.
  //
  // buildingToParkingSpot is the one place that knows which parking fields a
  // building has to leave null, so the destination is built there, not here.
  const handleBuildingPick = (building: CampusBuilding) => {
    setTravelMode("walking");
    startNavigation(buildingToParkingSpot(building));
    setQuery("");
  };

  const buildingSection = buildings.length > 0 && (
    <div key="buildings">
      <SectionHeader label="Buildings" />
      {buildings.map((building) => (
        <button
          key={building.building_id}
          // onMouseDown, not onClick, so the pick registers before the input's
          // blur closes the dropdown.
          onMouseDown={() => handleBuildingPick(building)}
          className={ROW_CLASS}
        >
          <i className="bi bi-building text-maroon text-lg flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm text-text1">{building.name}</div>
            <div className="text-xs text-text2">
              {[building.short_name, building.campus_location]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  const spotSection = spots.length > 0 && (
    <div key="spots">
      <SectionHeader label="Parking" />
      {spots.map((spot) => (
        <button
          key={spot.spot_id}
          onMouseDown={() => {
            startNavigation(spot);
            void logContextEvent("search_navigation_click", {
              spot_id: spot.spot_id,
              query,
            }).catch(() => undefined);
            setQuery("");
          }}
          className={ROW_CLASS}
        >
          <i className="bi bi-p-square-fill text-maroon text-lg flex-shrink-0" />
          <div>
            <div className="font-semibold text-sm text-text1">{spot.spot_name}</div>
            <div className="text-xs text-text2">
              {[spot.campus_location, spot.parking_type]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  // Whichever the active mode is about goes on top.
  const sections =
    appMode === "campus"
      ? [buildingSection, spotSection]
      : [spotSection, buildingSection];

  return (
    // Relative wrapper so the dropdown positions against it
    <div className="relative w-full">
      {/* Search pill - matches .gm-bar */}
      <div className="group flex items-center gap-2.5 bg-white rounded-[28px] h-12 px-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.12)] border-[1.5px] border-transparent focus-within:shadow-[0_0_0_3px_rgba(122,0,25,0.12)] focus-within:border-maroon transition-[border-color,box-shadow] duration-150">
        {/* Search icon - shifts darker on hover, maroon on focus to echo the focus border */}
        <i className="bi bi-search text-text3 text-base flex-shrink-0 transition-colors duration-200 group-hover:text-text2 group-focus-within:text-maroon" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay so tapping a result registers before blur closes the list
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder="Search buildings and parking..."
          className="flex-1 text-sm bg-transparent outline-none text-text1 placeholder:text-text3"
        />
        {/* Clear button - only shows when there's text */}
        {query.length > 0 && (
          <button
            onClick={() => setQuery("")}
            className="text-text3 flex-shrink-0"
          >
            <i className="bi bi-x-circle-fill text-base" />
          </button>
        )}
        {/* Gear icon - only on mobile (when onSettingsClick provided), on the right */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="group/cog grid place-items-center w-8 h-8 -mr-1 rounded-full text-text2 flex-shrink-0 hover:text-maroon hover:bg-maroon-light2 transition-colors duration-200"
            aria-label="Open settings"
          >
            <i className="bi bi-gear-fill text-lg transition-transform duration-300 ease-out group-hover/cog:rotate-90" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg overflow-hidden z-50 border border-black/9">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-text3">Searching...</div>
          )}

          {!isLoading && isEmpty && (
            <div className="px-4 py-3 text-sm text-text2">
              No results for "{query}"
            </div>
          )}

          {!isLoading && sections}
        </div>
      )}
    </div>
  );
}

const ROW_CLASS =
  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-black/5 last:border-b-0";

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text3">
      {label}
    </div>
  );
}
