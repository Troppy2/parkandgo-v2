import { useState } from "react"
import clsx from "clsx"

import { useNavStore } from "../../../store/navStore"
import PlacePicker from "./PlacePicker"

/**
 * The trip: where it starts, anywhere it stops, and where it ends.
 *
 * Shown only before Start. Editing a trip while being guided along it is a
 * different problem, with a live route to reconcile against, and is out of
 * scope here: once hasStartedNavigation flips, RouteDisplay hides this panel.
 *
 * THE SPINE. Every row draws its own glyph and its own connector segment, so
 * the marker beside a row is always that row's marker. The first version drew
 * the spine as one fixed column of three glyphs beside a list that grows, which
 * looked right at two rows and silently lied at three: with three stops the
 * destination pin sat 132px above the destination. Alignment is now structural
 * rather than coincidental, and cannot drift again.
 *
 * A stop's badge is filled with STOP_PIN_FILL, the same colour MapView gives
 * its numbered stop pins. That shared value is the whole point: the number in
 * the panel and the number on the map are one thing seen twice, which is what
 * lets someone match a pin to a row without reading place names off the map.
 */

// Kept in sync with the stop pins in MapView Effect 3a. Lighter than the maroon
// destination so the end of the trip still reads as the end.
export const STOP_PIN_FILL = "#A34A5E"

// Past this many stops the stop list scrolls instead of growing.
//
// The panel is fixed to the bottom of the screen and overlays the map, so
// unbounded growth first eats the map, then crosses the 60% camera-padding
// clamp in MapView (after which the destination can be framed behind the
// panel), and eventually clips its own top rows off the top of the screen with
// no way to scroll to them.
//
// Two, not three. At three the cap never engaged for the case it was written
// for, and giving every row a 44px target had already pushed the panel from
// 59% to 78% of a 390x844 screen: the accessibility fix quietly paid for itself
// in map coverage. Capping here holds the panel under half the screen no matter
// how many stops a trip carries.
const ROWS_BEFORE_SCROLL = 2

// Three rows of 44px plus their 8px gaps. Deliberately not a round number: it
// lands mid-row when there are more, which is what signals the list scrolls.
const STOP_LIST_MAX_HEIGHT = 156

type EditingRow = { kind: "origin" } | { kind: "destination" } | { kind: "stop"; id: string }

export default function RoutePlanner() {
  const origin = useNavStore((s) => s.origin)
  const stops = useNavStore((s) => s.stops)
  const destination = useNavStore((s) => s.destination)
  const currentUserLocation = useNavStore((s) => s.currentUserLocation)
  const setOrigin = useNavStore((s) => s.setOrigin)
  const addStop = useNavStore((s) => s.addStop)
  const setStopPlace = useNavStore((s) => s.setStopPlace)
  const removeStop = useNavStore((s) => s.removeStop)
  const moveStop = useNavStore((s) => s.moveStop)
  const swapEndpoints = useNavStore((s) => s.swapEndpoints)
  const setDestination = useNavStore((s) => s.setDestination)

  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [addingStop, setAddingStop] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  // Opens compact when a trip already has more stops than fit, which is the
  // same threshold that turns the list into a scroller. Expanded, three stops
  // put the panel at 569px of an 844px screen, past the 60% camera clamp in
  // MapView, so the destination can end up framed behind the panel. Adding a
  // stop expands the list again, so nothing a user adds is ever hidden from
  // them: this only decides what a trip they already built looks like on
  // arrival.
  const [collapsed, setCollapsed] = useState(() => stops.length > ROWS_BEFORE_SCROLL)

  if (!destination) return null

  // A swap has to put a concrete point in the destination slot, and "Your
  // location" is only concrete once there is a fix. Disabled rather than
  // silently doing nothing, so the reason is visible.
  const canSwap = origin !== null || currentUserLocation !== null

  const isEditing = (row: EditingRow) =>
    editing?.kind === row.kind &&
    (row.kind !== "stop" || (editing.kind === "stop" && editing.id === row.id))

  const closeAll = () => {
    setEditing(null)
    setAddingStop(false)
    setOpenMenuId(null)
  }

  return (
    <div className="px-3.5 pt-3.5 pb-2.5">
      <div id="trip-rows" className="space-y-2">
        <TripRow glyph={<OriginGlyph />} connectBelow>
          {isEditing({ kind: "origin" }) ? (
            <PlacePicker
              placeholder="Choose a starting point"
              onPick={(place) => {
                setOrigin(place)
                closeAll()
              }}
              onPickCurrentLocation={() => {
                setOrigin(null)
                closeAll()
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              <RowButton
                label={origin?.spot_name ?? "Your location"}
                muted={origin === null}
                onClick={() => setEditing({ kind: "origin" })}
              />
              {/* Swap rides in the origin row's control slot, the one a stop
                  fills with its options button. A header of its own cost 52px
                  of a panel that already covers most of the map, and this is
                  the row the control is about. */}
              <button
                type="button"
                onClick={swapEndpoints}
                disabled={!canSwap}
                aria-label="Swap start and destination"
                title={canSwap ? "Swap start and destination" : "Waiting for your location"}
                className={clsx(
                  "grid place-items-center w-11 h-11 flex-shrink-0 rounded-full transition-colors",
                  canSwap
                    ? "text-text2 hover:text-maroon hover:bg-maroon-light2"
                    : "text-text3 opacity-40 cursor-not-allowed"
                )}
              >
                <i className="bi bi-arrow-down-up text-base" />
              </button>
            </>
          )}
        </TripRow>

        {/* Only the stops scroll. The two endpoints stay pinned, so however
            long a trip gets, where it starts and where it ends are always on
            screen: those are the two rows a trip is actually about. */}
        <div
          className={clsx(
            "space-y-2",
            stops.length > ROWS_BEFORE_SCROLL && !collapsed && "overflow-y-auto"
          )}
          style={
            stops.length > ROWS_BEFORE_SCROLL && !collapsed
              ? { maxHeight: STOP_LIST_MAX_HEIGHT }
              : undefined
          }
        >
        {!collapsed &&
          stops.map((stop, index) => (
            <div key={stop.id}>
              <TripRow glyph={<StopGlyph number={index + 1} />} connectAbove connectBelow>
                {isEditing({ kind: "stop", id: stop.id }) ? (
                  <PlacePicker
                    placeholder="Choose a stop"
                    onPick={(place) => {
                      setStopPlace(stop.id, place)
                      closeAll()
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <RowButton
                      label={stop.place.spot_name}
                      onClick={() => setEditing({ kind: "stop", id: stop.id })}
                    />
                    {/* One control, not three. Three 32px buttons crowded the
                        place name down to 186px and sat under the 44px target
                        the rest of the app holds to, with Remove immediately
                        beside the two Move buttons. */}
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === stop.id ? null : stop.id)}
                      aria-expanded={openMenuId === stop.id}
                      aria-label={`Options for ${stop.place.spot_name}`}
                      className="grid place-items-center w-11 h-11 flex-shrink-0 rounded-full text-text2 hover:text-maroon hover:bg-maroon-light2 transition-colors"
                    >
                      <i className="bi bi-three-dots text-base" />
                    </button>
                  </>
                )}
              </TripRow>

              {openMenuId === stop.id && (
                <div className="flex gap-1.5 mt-1.5 ml-8">
                  <MenuAction
                    icon="bi-arrow-up"
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => moveStop(index, index - 1)}
                  />
                  <MenuAction
                    icon="bi-arrow-down"
                    label="Move down"
                    disabled={index === stops.length - 1}
                    onClick={() => moveStop(index, index + 1)}
                  />
                  <MenuAction
                    icon="bi-trash3"
                    label="Remove"
                    destructive
                    onClick={() => {
                      removeStop(stop.id)
                      setOpenMenuId(null)
                    }}
                  />
                </div>
              )}
            </div>
          ))}

        {addingStop && (
          <TripRow glyph={<StopGlyph number={stops.length + 1} />} connectAbove connectBelow>
            <PlacePicker
              placeholder="Search for a stop"
              onPick={(place) => {
                addStop(place)
                setAddingStop(false)
              }}
              onCancel={() => setAddingStop(false)}
            />
          </TripRow>
        )}
        </div>

        <TripRow glyph={<DestinationGlyph />} connectAbove>
          {isEditing({ kind: "destination" }) ? (
            <PlacePicker
              placeholder="Choose a destination"
              onPick={(place) => {
                setDestination(place)
                closeAll()
              }}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <RowButton
              label={destination.spot_name}
              onClick={() => setEditing({ kind: "destination" })}
            />
          )}
        </TripRow>
      </div>

      <div className="flex items-center justify-between mt-2">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false)
            setAddingStop(true)
          }}
          // "Add destination" was Google's label, and it works there because
          // the last row is the destination. Here a destination row already
          // sits below this button, so the old label named the wrong thing.
          className="flex items-center gap-2 ml-0.5 py-1.5 text-sm text-text2 hover:text-maroon transition-colors"
        >
          <i className="bi bi-plus-circle text-base" />
          Add stop
        </button>

        {stops.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCollapsed((prev) => !prev)
              setOpenMenuId(null)
            }}
            aria-expanded={!collapsed}
            aria-controls="trip-rows"
            className="flex items-center gap-1.5 py-1.5 pl-2 text-[12px] font-semibold text-text2 hover:text-maroon transition-colors"
          >
            {stops.length} {stops.length === 1 ? "stop" : "stops"}
            <i className={`bi bi-chevron-${collapsed ? "down" : "up"} text-[10px]`} />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * One row of the trip: its glyph, its connector segments, and its content.
 *
 * The connectors are drawn by the row rather than by a parent column, which is
 * what makes a misaligned spine impossible. Each segment reaches 8px past the
 * row's own edge, half the 8px gap from each side, so two neighbouring rows
 * meet in the middle of the gap and the line reads as continuous.
 */
function TripRow({
  glyph,
  connectAbove,
  connectBelow,
  children,
}: {
  glyph: React.ReactNode
  connectAbove?: boolean
  connectBelow?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 min-h-[44px]">
      <div className="relative w-6 flex-shrink-0 self-stretch grid place-items-center">
        {connectAbove && (
          <span className="absolute left-1/2 -translate-x-1/2 -top-2 bottom-1/2 w-px bg-black/12" />
        )}
        {connectBelow && (
          <span className="absolute left-1/2 -translate-x-1/2 top-1/2 -bottom-2 w-px bg-black/12" />
        )}
        <span className="relative">{glyph}</span>
      </div>
      {children}
    </div>
  )
}

function RowButton({
  label,
  muted,
  onClick,
}: {
  label: string
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 min-w-0 text-left text-sm border border-black/12 rounded-[10px] px-3 py-2.5 bg-white truncate transition-colors hover:border-maroon",
        muted ? "text-text3" : "text-text1"
      )}
    >
      {label}
    </button>
  )
}

function MenuAction({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-[10px] border text-[12px] font-semibold transition-colors",
        disabled && "opacity-35 cursor-not-allowed",
        destructive
          ? "border-maroon/30 text-maroon hover:bg-maroon-light"
          : "border-black/12 text-text2 hover:border-maroon hover:text-maroon"
      )}
    >
      <i className={`bi ${icon} text-xs`} />
      {label}
    </button>
  )
}

function OriginGlyph() {
  return <span className="block w-3 h-3 rounded-full border-2 border-text3 bg-white" />
}

function StopGlyph({ number }: { number: number }) {
  return (
    <span
      className="grid place-items-center w-6 h-6 rounded-full text-white text-[11px] font-bold tabular-nums"
      style={{ backgroundColor: STOP_PIN_FILL }}
    >
      {number}
    </span>
  )
}

function DestinationGlyph() {
  return <i className="bi bi-geo-alt-fill text-maroon text-base leading-none" />
}
