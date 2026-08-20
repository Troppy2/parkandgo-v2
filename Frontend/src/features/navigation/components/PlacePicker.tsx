import { useState } from "react"

import { useTripPlaceSearch } from "../../search/hooks/useTripPlaceSearch"
import type { ParkingSpot } from "../../../types/parking.types"

/**
 * Inline search field for choosing one place on a trip.
 *
 * Deliberately not a reuse of SearchBar. That component owns the map's global
 * search: it starts navigation on pick, logs an analytics event, and is styled
 * as a floating pill. This one fills a row in the planner and hands the chosen
 * place back to its parent. What the two genuinely share, running the building
 * and spot queries together, lives in useTripPlaceSearch and is shared.
 */

interface PlacePickerProps {
  /** Shown in the empty input. */
  placeholder: string
  /** Fired with the chosen place. The parent closes the picker. */
  onPick: (place: ParkingSpot) => void
  onCancel: () => void
  /** Offered as a choice only where it makes sense, so the origin row. */
  onPickCurrentLocation?: () => void
}

export default function PlacePicker({
  placeholder,
  onPick,
  onCancel,
  onPickCurrentLocation,
}: PlacePickerProps) {
  const [query, setQuery] = useState("")
  const { buildings, spots, addresses, isLoading, isEmpty } = useTripPlaceSearch(query)

  const showResults = query.length >= 2

  const SECTION_ICON: Record<string, string> = {
    Buildings: "bi-building",
    Parking: "bi-p-square-fill",
    Addresses: "bi-signpost-2-fill",
  }

  const section = (label: string, places: ParkingSpot[]) =>
    places.length > 0 && (
      <div key={label}>
        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text3">
          {label}
        </div>
        {places.map((place, index) => (
          <button
            // Indexed rather than keyed on spot_id: every geocoded address
            // shares one sentinel id, since nothing downstream keys off it.
            key={`${label}-${index}`}
            type="button"
            onMouseDown={() => onPick(place)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-black/5 last:border-b-0"
          >
            <i className={`bi ${SECTION_ICON[label]} text-maroon text-base flex-shrink-0`} />
            <div className="min-w-0">
              <div className="text-sm text-text1 truncate">{place.spot_name}</div>
              {/* Campus for our own places, the full geocoded string for an
                  address, which is what tells two similar streets apart. */}
              {(place.campus_location ?? (label === "Addresses" ? place.address : null)) && (
                <div className="text-[11px] text-text2 truncate">
                  {place.campus_location ?? place.address}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    )

  return (
    <div className="relative w-full">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel()
        }}
        // Delayed so a tap on a result registers before the blur closes it,
        // the same 150ms the search bar dropdown uses.
        onBlur={() => setTimeout(onCancel, 150)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full text-sm bg-white border-[1.5px] border-maroon rounded-[10px] px-3 py-2 outline-none text-text1 placeholder:text-text3"
      />

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg overflow-hidden z-50 border border-black/9 max-h-64 overflow-y-auto">
          {isLoading && <div className="px-3 py-2 text-sm text-text3">Searching...</div>}
          {!isLoading && isEmpty && (
            <div className="px-3 py-2 text-sm text-text2">No places found</div>
          )}
          {/* Our own data first, both sections, then anywhere else on the
              map. Someone typing in a campus app means a campus place far more
              often than a street, and addresses arrive later anyway. */}
          {!isLoading && [
            section("Buildings", buildings),
            section("Parking", spots),
            section("Addresses", addresses),
          ]}
        </div>
      )}

      {onPickCurrentLocation && !showResults && (
        <button
          type="button"
          onMouseDown={onPickCurrentLocation}
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-black/9 z-50 flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          <i className="bi bi-crosshair text-maroon text-base" />
          <span className="text-sm text-text1">Your location</span>
        </button>
      )}
    </div>
  )
}
