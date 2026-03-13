import { useState } from "react";
import clsx from "clsx";
import { useSearch } from "../hooks/useSearch";
import { useNavStore } from "../../../store/navStore";

interface SearchBarProps {
  onSettingsClick?: () => void;
}

export default function SearchBar({ onSettingsClick }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const { data: results, isLoading } = useSearch(query);
  const startNavigation = useNavStore((s) => s.startNavigation);

  const showResults = isFocused && query.length >= 2;

  return (
    // Relative wrapper so the dropdown positions against it
    <div className="relative w-full">
      {/* Search pill - matches .gm-bar */}
      <div className="flex items-center gap-2.5 bg-white rounded-[28px] h-12 px-3.5 shadow-md">
        {onSettingsClick ? (
          <button
            onClick={onSettingsClick}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon to-maroon-hover flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:-translate-y-[1px]"
          >
            <i className="bi bi-gear-fill text-white text-sm" />
          </button>
        ) : (
          <i className="bi bi-search text-text3 text-base flex-shrink-0" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay so tapping a result registers before blur closes the list
            setTimeout(() => setIsFocused(false), 150);
          }}
          placeholder="Search parking spots..."
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
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg overflow-hidden z-50 border border-black/9">
          {isLoading && (
            <div className="px-4 py-3 text-sm text-text3">Searching...</div>
          )}

          {!isLoading && results?.length === 0 && (
            <div className="px-4 py-3 text-sm text-text2">
              No spots found for "{query}"
            </div>
          )}

          {!isLoading &&
            results &&
            results.map((spot, i) => (
              <button
                key={spot.spot_id}
                onMouseDown={() => {
                  startNavigation(spot);
                  setQuery("");
                }}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors",
                  i < results.length - 1 ? "border-b border-black/5" : ""
                )}
              >
                <i className="bi bi-p-square-fill text-maroon text-lg flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-text1">
                    {spot.spot_name}
                  </div>
                  <div className="text-xs text-text2">
                    {[spot.campus_location, spot.parking_type]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
