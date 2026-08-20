import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { useUIStore } from "../../../store/uiStore";
import { useNavStore } from "../../../store/navStore";
import {
    UMN_CENTER,
    UMN_DEFAULT_ZOOM,
    STANDARD_STYLE,
    SATELLITE_STYLE,
    BUILDINGS_3D_STYLE,
} from "../../../lib/map/mapStyles";
import { snapToRouteWithBearing } from "../../navigation/components/services/routingApi";
import type { RouteResult } from "../../navigation/components/services/routingApi";
import MapControls, { ControlButton, ControlPill, LocateIcon } from "./MapControls";
import RouteLayer from "./RouteLayer";
import { STOP_PIN_FILL } from "../../navigation/components/RoutePlanner";
import { useEvents } from "../../events/hooks/useEvents";
import { useNearbyBuildings } from "../../campus/hooks/useCampusBuildings";
import {
    createTeardropPin,
    createNavigationPuck,
    createUserLocationMarker,
    shortestArcRotation,
} from "../../../lib/map/markerElements";

const MAP_GEOLOCATION_OPTIONS = {
    maximumAge: 5000,
    timeout: 15000,
    enableHighAccuracy: true,
} as const;

const ZERO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 } as const;

// Active-guidance camera: tilted, close in, and turned to face the direction of
// travel, so the map reads as turn-by-turn perspective rather than a flat plan
// view. The pitch is the same 45 the 3D style block uses, per issue #13.
const NAV_CAMERA_PITCH = 45;
const NAV_CAMERA_ZOOM = 17;

// Below this the map holds its current bearing. GPS heading is noisy at walking
// pace and at a standstill, and rotating the whole world by a degree and a half
// every fix is worse than a bearing that lags slightly behind the truth.
const NAV_BEARING_DEADBAND_DEG = 4;

// Move the camera into the guidance view, degrading to a flat one where pitch
// is unsupported. Mirrors the try/catch the 3D style block already uses: not
// every device can render a tilted map, and a thrown pitch must not take the
// recenter with it.
function moveToNavCamera(
    map: maplibregl.Map,
    options: maplibregl.FlyToOptions,
    bearing: number | null,
) {
    const tilted = {
        ...options,
        pitch: NAV_CAMERA_PITCH,
        ...(bearing == null ? {} : { bearing }),
    };

    try {
        map.flyTo(tilted);
    } catch {
        console.warn("Tilted navigation camera not supported on this device, using 2D mode");
        map.flyTo(options);
    }
}

// Smallest signed turn from one compass bearing to another, in degrees.
function bearingDelta(from: number, to: number): number {
    return (((to - from) % 360) + 540) % 360 - 180;
}

// Bottom camera padding that keeps the route panel from covering what we center on.
//
// The panel is fixed to the bottom of the viewport and overlays the map, so
// without this the map centers on the geometric middle of the container, which
// sits behind the panel. Clamped because MapLibre misbehaves once padding
// approaches the container size, and a short viewport with the details drawer
// open gets close.
function clampedBottom(map: maplibregl.Map, panelHeight: number): number {
    const containerHeight = map.getContainer?.()?.clientHeight ?? 0;
    if (!containerHeight) return panelHeight;
    return Math.min(panelHeight, containerHeight * 0.6);
}

// Where the user reads as being on the map right now.
//
// Shared by the marker effect and the follow-camera effect so the two can
// never disagree: if the marker is snapped to the route, the camera centers on
// the snapped point too, otherwise the camera would chase raw GPS noise while
// the dot sits still on the road.
function displayCoordsFor(
    userLocation: { coords: [number, number] },
    isNavigating: boolean,
    travelMode: string,
    route: RouteResult | null,
): [number, number] {
    return snappedTo(userLocation, isNavigating, travelMode, route)?.point ?? userLocation.coords;
}

// Which way the user reads as facing right now.
//
// Sits beside displayCoordsFor on purpose and snaps under exactly the same
// condition, so the puck can never point along a road it is not drawn on. Raw
// GPS heading is the fallback: it is all we have off-route and on foot.
function displayHeadingFor(
    userLocation: { coords: [number, number]; heading: number },
    isNavigating: boolean,
    travelMode: string,
    route: RouteResult | null,
): number {
    return snappedTo(userLocation, isNavigating, travelMode, route)?.bearing ?? userLocation.heading;
}

function snappedTo(
    userLocation: { coords: [number, number] },
    isNavigating: boolean,
    travelMode: string,
    route: RouteResult | null,
) {
    return isNavigating && travelMode === "driving" && route && route.coordinates.length > 1
        ? snapToRouteWithBearing(userLocation.coords, route.coordinates)
        : null;
}

function add3DBuildings(map: maplibregl.Map) {
    // Find the first text label layer so we insert buildings BELOW labels
    // (otherwise building extrusions cover up street names)
    const layers = map.getStyle().layers;
    let labelLayerId: string | undefined;

    for (const layer of layers) {
        if (
            layer.type === "symbol" &&
            "layout" in layer &&
            (layer.layout as Record<string, unknown>)?.["text-field"]
        ) {
            labelLayerId = layer.id;
            break;
        }
    }
    map.addLayer(
        {
            id: "3d-buildings",
            source: "openmaptiles",
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
                "fill-extrusion-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "render_height"],
                    0,
                    "#e0e0e0",
                    50,
                    "#b0b0b0",
                    100,
                    "#808080",
                    200,
                    "#505050",
                ],
                "fill-extrusion-height": ["get", "render_height"],
                "fill-extrusion-base": ["get", "render_min_height"],
                "fill-extrusion-opacity": 0.8,
            },
        },
        labelLayerId,
    );
}

export default function MapView() {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const watchIdRef = useRef<number | null>(null);
    const wasNavigatingRef = useRef(false);
    const wasStartedNavigationRef = useRef(false);
    const userLocationRef = useRef<{ coords: [number, number]; heading: number } | null>(null);
    const [followPaused, setFollowPaused] = useState(false);
    // The map, as state as well as a ref.
    //
    // RouteLayer takes the map as a prop, and a ref assigned inside an effect
    // does not re-render anyone: passing mapRef.current handed RouteLayer null
    // on the first render and the real map only on MapView's next render, which
    // nothing schedules. In practice that meant the route line waited for an
    // unrelated GPS fix, which is why it drew instantly sometimes and seconds
    // late other times. The ref stays for the effects that need a handle
    // without re-rendering.
    const [mapReady, setMapReady] = useState<maplibregl.Map | null>(null);
    const mapStyle = useUIStore((s) => s.mapStyle);
    const setMapInstance = useUIStore((s) => s.setMapInstance);
    const navPanelHeight = useUIStore((s) => s.navPanelHeight);

    const activeTab = useUIStore((s) => s.activeTab);
    const appMode = useUIStore((s) => s.appMode);
    const { data: events } = useEvents();
    const destination = useNavStore((s) => s.destination);
    const stops = useNavStore((s) => s.stops);
    const isNavigating = useNavStore((s) => s.isNavigating);
    const hasStartedNavigation = useNavStore((s) => s.hasStartedNavigation);
    const userLocation = useNavStore((s) => s.currentUserLocation);
    const setCurrentUserLocation = useNavStore((s) => s.setCurrentUserLocation);
    const route = useNavStore((s) => s.route);
    const travelMode = useNavStore((s) => s.travelMode);

    // Campus building pins, only fetched while Campus Mode is active.
    const { data: nearbyBuildings } = useNearbyBuildings(
        appMode === "campus" ? userLocation?.coords ?? null : null,
    );

    // All spots visible on the map - public endpoint, no auth required

    // Track event markers so we can remove them when tab switches
    const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
    // Track campus building markers so we can remove them when mode switches
    const buildingMarkersRef = useRef<maplibregl.Marker[]>([]);
    // Track the single destination marker
    const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
    // Track intermediate stop markers so a trip edit can clear them
    const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
    // Track the user location marker
    const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
    // Which marker the map is currently showing: the idle location dot, or the
    // active-guidance puck. Effect 4 rebuilds the marker only when this flips.
    const userMarkerKindRef = useRef<"dot" | "puck" | null>(null);
    // Last rotation written to the marker, as a continuous (unwrapped) angle so
    // a turn through north eases the short way instead of spinning 340 degrees.
    const markerRotationRef = useRef(0);
    // Last compass heading the marker was told to point at. Kept separately from
    // the rotation above because the rotation is screen-space: on a course-up
    // map the element barely turns while the heading sweeps right around.
    const markerHeadingRef = useRef<number | null>(null);
    // Pitch and bearing from before guidance started, restored when it ends so
    // a trip does not permanently leave the map tilted.
    const preNavCameraRef = useRef<{ pitch: number; bearing: number } | null>(null);
    // Which destination the camera has already framed, so a panel resize eases
    // the padding instead of re-flying the whole route.
    const framedDestinationRef = useRef<number | string | null>(null);
    // Bottom padding currently applied to the camera, so a re-render that did
    // not actually resize the panel does not start a pointless camera move.
    const appliedBottomRef = useRef<number | null>(null);
    // A padding change that arrived while the camera was already moving, parked
    // until that move finishes. See Effect 3b.
    const pendingPaddingRef = useRef<(() => void) | null>(null);
    // Follow-camera state. The ref is what the gesture handlers and the follow
    // effect read, the state value only drives the Recenter button's visibility.
    const followPausedRef = useRef(false);
    // False from the moment Start is pressed until the fly-to-user lands, so
    // the follow effect cannot cancel that fly with a competing ease.
    const followArmedRef = useRef(false);
    // Track parking spot markers

    // Effect 1: Initialize map ONCE on mount
    useEffect(() => {
        if (!mapContainer.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: STANDARD_STYLE,
            center: UMN_CENTER,
            zoom: UMN_DEFAULT_ZOOM,
            maxTileCacheSize: 800,
        });

        mapRef.current = map;
        setMapReady(map);
        setMapInstance(map);

        // Watch user geolocation for the locate-me button
        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (pos) => setCurrentUserLocation({
                    coords: [pos.coords.longitude, pos.coords.latitude],
                    heading: pos.coords.heading ?? 0,
                }),
                () => {/* geolocation unavailable - map still works without it */ },
                MAP_GEOLOCATION_OPTIONS,
            );
        }

        // Pause follow the moment the user takes the camera into their own
        // hands. Only user-driven moves carry originalEvent, so the follow
        // effect's own eases cannot pause themselves into a deadlock. Nav state
        // is read fresh from the store because this effect runs once and its
        // closure would otherwise hold the values from mount.
        const pauseFollowOnGesture = (e: { originalEvent?: unknown }) => {
            if (!e?.originalEvent) return;
            const { isNavigating: navActive, hasStartedNavigation: started } = useNavStore.getState();
            if (!navActive || !started) return;
            followPausedRef.current = true;
            setFollowPaused(true);
        };

        const GESTURE_EVENTS = ["dragstart", "zoomstart", "rotatestart", "pitchstart"] as const;
        GESTURE_EVENTS.forEach((name) => map.on(name, pauseFollowOnGesture));

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            GESTURE_EVENTS.forEach((name) => map.off(name, pauseFollowOnGesture));
            map.remove();
            // map.remove() takes its markers with it, so drop the handles too:
            // a rebuilt map must start from no marker rather than adopt a
            // detached element that will never be positioned again.
            userLocationMarkerRef.current = null;
            userMarkerKindRef.current = null;
            markerRotationRef.current = 0;
            setMapReady(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCurrentUserLocation]);

    // Effect 2: Add/remove event pins when tab or events data changes
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing event markers first
        eventMarkersRef.current.forEach((m) => m.remove());
        eventMarkersRef.current = [];

        // Only add event pins when Events tab is active
        if (activeTab !== "events" || !events) return;

        events.forEach((event) => {
            if (event.latitude == null || event.longitude == null) return;
            const eventCenter: [number, number] = [event.longitude, event.latitude];

            // Gold teardrop event pin (Google/Apple Maps idiom). All transforms
            // live on child elements, so MapLibre keeps full control of the root's
            // positioning transform.
            const el = createTeardropPin({
                fill: "#FFCC33",
                iconClass: "bi-calendar-event-fill",
                iconColor: "#7A0019",
                size: 28,
            });

            el.addEventListener("click", () => {
                mapRef.current?.flyTo({
                    center: eventCenter,
                    zoom: 17,
                    duration: 600,
                    essential: true,
                });
            });

            const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                .setLngLat(eventCenter)
                .setPopup(
                    new maplibregl.Popup({ offset: 30, closeButton: false })
                        .setHTML(`<strong style="font-size:12px">${event.title}</strong><br/><span style="font-size:11px;color:#666">${event.location_name ?? ""}</span>`)
                )
                .addTo(mapRef.current!);

            eventMarkersRef.current.push(marker);
        });
    }, [activeTab, events]);

    // Effect 2b: Add/remove campus building pins when the app mode changes.
    //
    // Only the nearby set is pinned, never all 261 buildings: at campus zoom
    // the East Bank becomes an unreadable wall of markers otherwise. Mirrors
    // the clear-then-rebuild shape of the event marker effect above.
    useEffect(() => {
        if (!mapRef.current) return;

        buildingMarkersRef.current.forEach((m) => m.remove());
        buildingMarkersRef.current = [];

        if (appMode !== "campus" || activeTab === "events" || !nearbyBuildings) return;

        nearbyBuildings.forEach((building) => {
            const center: [number, number] = [building.longitude, building.latitude];

            // Maroon pin with a gold building glyph, so campus destinations read
            // as distinct from the gold event pins and the bare maroon
            // destination pin without introducing a new colour to the system.
            const el = createTeardropPin({
                fill: "#7A0019",
                iconClass: "bi-building",
                iconColor: "#FFCC33",
                size: 26,
            });

            el.addEventListener("click", () => {
                mapRef.current?.flyTo({
                    center,
                    zoom: 17,
                    duration: 600,
                    essential: true,
                });
            });

            const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
                .setLngLat(center)
                .setPopup(
                    new maplibregl.Popup({ offset: 30, closeButton: false })
                        .setHTML(`<strong style="font-size:12px">${building.name}</strong><br/><span style="font-size:11px;color:#666">${building.short_name ?? building.campus_location ?? ""}</span>`)
                )
                .addTo(mapRef.current!);

            buildingMarkersRef.current.push(marker);
        });
    }, [appMode, activeTab, nearbyBuildings]);

    // Effect 3: Add/remove destination marker when navStore.destination changes
    useEffect(() => {
        // Remove previous destination marker
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;

        if (!destination || !mapRef.current) return;
        if (destination.longitude == null || destination.latitude == null) return;

        // Clean maroon teardrop destination pin, matching the shared place-marker system.
        const el = createTeardropPin({
            fill: "#7A0019",
            iconColor: "#7A0019",
            size: 34,
        });

        destinationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([destination.longitude, destination.latitude])
            .addTo(mapRef.current);
    }, [destination]);

    // Effect 3a: Numbered pins for intermediate stops.
    //
    // Kept separate from the destination marker above so a stop edit does not
    // rebuild the destination pin, and clear-then-rebuild like the event and
    // building pins rather than diffed: the list is a handful of markers and
    // reordering changes every number anyway.
    useEffect(() => {
        stopMarkersRef.current.forEach((marker) => marker.remove());
        stopMarkersRef.current = [];

        if (!mapRef.current) return;

        stops.forEach((stop, index) => {
            const { longitude, latitude } = stop.place;
            if (longitude == null || latitude == null) return;

            // Numbered so the pin and its row in the planner read as the same
            // stop. Lighter than the destination so the end of the trip still
            // stands out as the end.
            //
            // The fill is imported rather than repeated: the badge on the
            // planner row uses the same value, and a pin that no longer matches
            // its row is worse than no colour coding at all.
            const el = createTeardropPin({
                fill: STOP_PIN_FILL,
                iconColor: "#FFFFFF",
                label: String(index + 1),
                size: 30,
            });

            stopMarkersRef.current.push(
                new maplibregl.Marker({ element: el, anchor: "bottom" })
                    .setLngLat([longitude, latitude])
                    .addTo(mapRef.current!),
            );
        });
    }, [stops]);

    // Effect 3b: Frame the destination in the strip of map the route panel leaves visible.
    //
    // This owns navigation camera padding, deliberately as one effect rather
    // than a fly here and a padding sync there: two effects would each start
    // their own animation and the second would cancel the first mid-flight,
    // stranding the camera at a half-applied padding.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (!isNavigating || !destination) {
            // Padding is cleared by the fly-back in Effect 5a, which needs to
            // do it inside its own camera move for the same reason.
            framedDestinationRef.current = null;
            appliedBottomRef.current = null;
            if (pendingPaddingRef.current) {
                map.off("moveend", pendingPaddingRef.current);
                pendingPaddingRef.current = null;
            }
            return;
        }
        if (destination.longitude == null || destination.latitude == null) return;

        const center: [number, number] = [destination.longitude, destination.latitude];

        if (framedDestinationRef.current !== destination.spot_id) {
            framedDestinationRef.current = destination.spot_id;
            // Read the height fresh rather than from this effect's closure.
            // RouteDisplay attaches its ref during the layout phase of the same
            // commit that starts navigation, so the store already holds a
            // measurement this render was too early to see. Falls back to an
            // unpadded fly when the panel is not mounted at all, so the camera
            // never depends on another component being on screen.
            const bottom = clampedBottom(map, useUIStore.getState().navPanelHeight);
            appliedBottomRef.current = bottom;
            map.flyTo({
                center,
                zoom: 16,
                duration: 1000,
                essential: true,
                padding: { ...ZERO_PADDING, bottom },
            });
            return;
        }

        // Same destination. Only move for a real padding change, which means
        // the panel resized: the details drawer opened, or the Cancel/Start row
        // went away. Without this guard the effect would also fire on the
        // hasStartedNavigation flip and its ease would cancel Effect 5's
        // fly-to-user mid-flight.
        const bottom = clampedBottom(map, navPanelHeight);
        if (appliedBottomRef.current === bottom) return;
        appliedBottomRef.current = bottom;

        // Before Start the destination is what the camera frames, so re-center
        // it as the padding eases. After Start the camera has its own target
        // (the user), so the padding moves on its own and leaves the center be.
        const padding = { ...ZERO_PADDING, bottom };
        const applyPadding = () => {
            pendingPaddingRef.current = null;
            map.easeTo(
                hasStartedNavigation
                    ? { padding, duration: 300, essential: true }
                    : { center, padding, duration: 300, essential: true },
            );
        };

        // A padding update must never cancel a camera move it does not own.
        //
        // Pressing Start drops the Cancel/Start row, so the panel shrinks and
        // the ResizeObserver reports a new height while Effect 5 is already
        // flying to the user. Easing here would cancel that fly, and since
        // ResizeObserver runs before paint the camera would never visibly move
        // at all. Parking the change until moveend keeps the fly intact, and an
        // ease with no center then adjusts padding without pulling the camera
        // off wherever the fly landed.
        if (pendingPaddingRef.current) {
            map.off("moveend", pendingPaddingRef.current);
            pendingPaddingRef.current = null;
        }
        if (map.isMoving()) {
            pendingPaddingRef.current = applyPadding;
            map.once("moveend", applyPadding);
            return;
        }
        applyPadding();
    }, [destination, isNavigating, hasStartedNavigation, navPanelHeight]);

    // Point the marker at a compass heading, in screen space.
    //
    // The heading is geographic but the element rotation is not: on a course-up
    // map the camera is already turned to the direction of travel, so writing
    // the raw heading would rotate the puck twice and leave it pointing at
    // double the true course. Subtracting the map bearing is what keeps the
    // chevron aimed down the road in both course-up and north-up views.
    const applyMarkerRotation = useCallback(() => {
        const map = mapRef.current;
        const heading = markerHeadingRef.current;
        if (!map || heading == null) return;

        const target = heading - (map.getBearing?.() ?? 0);
        // Unwrapped so the CSS transition takes the short way round a pass
        // through north instead of spinning most of a full turn backwards.
        const rotation = shortestArcRotation(markerRotationRef.current, target);
        markerRotationRef.current = rotation;

        const markerEl = userLocationMarkerRef.current?.getElement?.();
        const svg = markerEl?.querySelector('[data-heading-transform="true"]') as SVGElement | null;
        if (svg) svg.style.transform = `rotate(${rotation}deg)`;
    }, []);

    // Effect 4: Update user location marker when userLocation changes
    //
    // Two markers share this slot: the idle dot while the user is browsing, and
    // the navigation puck once Start is pressed. Only a change of kind rebuilds
    // the DOM; every other update is .setLngLat() plus a rotation write.
    useEffect(() => {
        if (!userLocation || !mapRef.current) return;

        // Snap to road when driving and a route is loaded
        const displayCoords = displayCoordsFor(userLocation, isNavigating, travelMode, route);
        const heading = displayHeadingFor(userLocation, isNavigating, travelMode, route);
        const kind = isNavigating && hasStartedNavigation ? "puck" : "dot";

        if (userMarkerKindRef.current !== kind) {
            userLocationMarkerRef.current?.remove();

            const el = kind === "puck" ? createNavigationPuck() : createUserLocationMarker();
            userLocationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat(displayCoords)
                .addTo(mapRef.current);
            userMarkerKindRef.current = kind;
            // A fresh element starts unrotated, so the continuous angle has to
            // restart there too or the first write would ease in from an angle
            // the new marker was never drawn at.
            markerRotationRef.current = 0;
        } else {
            userLocationMarkerRef.current?.setLngLat(displayCoords);
        }

        // A device that reports no heading holds the last one. Snapping to north
        // whenever the fix drops would read as the puck flicking on and off course.
        if (Number.isFinite(heading)) markerHeadingRef.current = heading;
        applyMarkerRotation();
    }, [userLocation, isNavigating, hasStartedNavigation, travelMode, route, applyMarkerRotation]);

    // The map turns under the marker during guidance, so the marker only has to
    // make up the difference. Repainting on "rotate" keeps that true through a
    // camera turn the marker effect never hears about, and through a manual
    // two-finger rotate while follow is paused.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        map.on("rotate", applyMarkerRotation);
        return () => {
            map.off("rotate", applyMarkerRotation);
        };
    }, [applyMarkerRotation]);

    // Keep userLocationRef in sync so the navigation effects can read it without a stale closure.
    useEffect(() => {
        userLocationRef.current = userLocation;
    }, [userLocation]);

    // Effect 5: Fly to the user's position when the Start button begins active guidance.
    useEffect(() => {
        const navigationJustStarted =
            !wasStartedNavigationRef.current && isNavigating && hasStartedNavigation;

        if (navigationJustStarted) {
            const loc = userLocationRef.current;

            // Every trip begins in follow mode, and follow stays disarmed until
            // the opening fly lands so it cannot cut that animation short.
            followPausedRef.current = false;
            setFollowPaused(false);
            followArmedRef.current = false;
            const armFollow = () => {
                followArmedRef.current = true;
            };

            // Remember the camera the user was browsing with. Guidance tilts
            // and turns the map, and ending the trip has to give that back.
            const map = mapRef.current;
            if (map) {
                preNavCameraRef.current = {
                    pitch: map.getPitch?.() ?? 0,
                    bearing: map.getBearing?.() ?? 0,
                };
            }

            if (loc && map) {
                map.once("moveend", armFollow);
                moveToNavCamera(
                    map,
                    {
                        center: loc.coords,
                        zoom: NAV_CAMERA_ZOOM,
                        duration: 900,
                        essential: true,
                    },
                    Number.isFinite(loc.heading) ? loc.heading : null,
                );
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const nextLocation = {
                            coords: [pos.coords.longitude, pos.coords.latitude] as [number, number],
                            heading: pos.coords.heading ?? 0,
                        };

                        setCurrentUserLocation(nextLocation);
                        const readyMap = mapRef.current;
                        if (!readyMap) return;

                        readyMap.once("moveend", armFollow);
                        moveToNavCamera(
                            readyMap,
                            {
                                center: nextLocation.coords,
                                zoom: NAV_CAMERA_ZOOM,
                                duration: 900,
                                essential: true,
                            },
                            Number.isFinite(nextLocation.heading) ? nextLocation.heading : null,
                        );
                    },
                    () => {
                        // Keep the destination centered if user location is unavailable.
                    },
                    MAP_GEOLOCATION_OPTIONS,
                );
            }
        }

        wasStartedNavigationRef.current = hasStartedNavigation;
    }, [hasStartedNavigation, isNavigating, setCurrentUserLocation]);

    // Effect 5a: Fly back to user location when navigation ends
    useEffect(() => {
        if (wasNavigatingRef.current && !isNavigating) {
            const loc = userLocationRef.current;
            const map = mapRef.current;
            // Stop following before the fly-back, otherwise the next GPS fix
            // would ease the camera away from where this fly is heading.
            followArmedRef.current = false;
            followPausedRef.current = false;
            setFollowPaused(false);
            // Hand back the pitch and bearing the user was browsing with. A
            // trip that ended should not leave the map permanently tilted and
            // turned to whatever direction the last leg happened to run.
            const before = preNavCameraRef.current ?? { pitch: 0, bearing: 0 };
            preNavCameraRef.current = null;

            if (map) {
                // Drop the route panel's padding as part of this same camera
                // move. Resetting it separately would race the fly-back and one
                // animation would cancel the other, and the same is true of the
                // pitch and bearing reset.
                if (loc) {
                    map.flyTo({
                        center: loc.coords,
                        zoom: 16,
                        duration: 800,
                        essential: true,
                        padding: ZERO_PADDING,
                        pitch: before.pitch,
                        bearing: before.bearing,
                    });
                } else {
                    map.setPadding(ZERO_PADDING);
                    map.setPitch(before.pitch);
                    map.setBearing(before.bearing);
                }
            }
        }
        wasNavigatingRef.current = isNavigating;
    }, [isNavigating]);

    // Effect 5b: Keep the camera on the user while guidance is active.
    //
    // Without this the marker moves and the viewport does not, so the driver
    // watches themselves slide off the screen (issue #10). The camera also
    // holds the course-up bearing here, since the opening fly only sets it once
    // and every turn after that would otherwise leave the map facing the way
    // the trip started. Zoom is left alone: the opening fly picked it, and past
    // that it belongs to the user until they press recenter.
    //
    // Padding is passed through from what Effect 3b applied. This ease can land
    // on top of that effect's padding ease, and an ease with no padding would
    // strand the camera at a half-applied value.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !userLocation) return;
        if (!isNavigating || !hasStartedNavigation) return;
        if (!followArmedRef.current || followPausedRef.current) return;

        const center = displayCoordsFor(userLocation, isNavigating, travelMode, route);
        const heading = displayHeadingFor(userLocation, isNavigating, travelMode, route);
        const bottom = appliedBottomRef.current;

        // Turn only for a real course change. Heading noise at walking pace and
        // at a standstill is a couple of degrees per fix, and spinning the whole
        // map by that every second is far worse than a slightly stale bearing.
        const turned =
            Number.isFinite(heading) &&
            Math.abs(bearingDelta(map.getBearing?.() ?? 0, heading)) > NAV_BEARING_DEADBAND_DEG;

        // Short duration so consecutive fixes read as continuous motion rather
        // than a series of hops.
        map.easeTo({
            center,
            duration: 500,
            essential: true,
            ...(turned ? { bearing: heading } : {}),
            ...(bottom == null ? {} : { padding: { ...ZERO_PADDING, bottom } }),
        });
    }, [userLocation, isNavigating, hasStartedNavigation, travelMode, route]);

    // Resume following after a manual pan, from the Recenter button.
    //
    // During guidance this restores the whole guidance camera, not just the
    // center: one press has to undo any amount of panning, zooming out, and
    // rotating, because that is the state the button appears in. Outside
    // guidance it stays a plain recenter.
    const handleRecenter = useCallback(() => {
        followPausedRef.current = false;
        followArmedRef.current = true;
        setFollowPaused(false);

        const map = mapRef.current;
        const loc = userLocationRef.current;
        if (!map || !loc) return;

        const bottom = appliedBottomRef.current;
        const padding = bottom == null ? {} : { padding: { ...ZERO_PADDING, bottom } };
        const center = displayCoordsFor(loc, isNavigating, travelMode, route);

        if (!hasStartedNavigation) {
            map.easeTo({ center, duration: 500, essential: true, ...padding });
            return;
        }

        const heading = displayHeadingFor(loc, isNavigating, travelMode, route);
        moveToNavCamera(
            map,
            { center, zoom: NAV_CAMERA_ZOOM, duration: 600, essential: true, ...padding },
            Number.isFinite(heading) ? heading : null,
        );
    }, [isNavigating, hasStartedNavigation, travelMode, route]);

    // Effect 6: React to style changes from uiStore
    // This runs whenever the user changes the map style in Settings
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        try {
            if (mapStyle === "standard") {
                map.setStyle(STANDARD_STYLE);
                map.setPitch(0);
                map.setBearing(0);
            } else if (mapStyle === "satellite") {
                map.setStyle(SATELLITE_STYLE as maplibregl.StyleSpecification);
                map.setPitch(0);
                map.setBearing(0);
            } else if (mapStyle === "3d") {
                map.setStyle(BUILDINGS_3D_STYLE);
                // Wrap 3D-specific features in try/catch to handle unsupported browsers gracefully
                try {
                    map.setPitch(45);
                    map.setBearing(-17.6);
                } catch {
                    console.warn("3D map features not supported on this device, using 2D mode");
                    // Fallback: reset to 2D
                    map.setPitch(0);
                    map.setBearing(0);
                }
                map.once("style.load", () => {
                    try {
                        add3DBuildings(map);
                    } catch (e) {
                        console.warn("Failed to load 3D buildings:", e);
                    }
                });
            }
        } catch (e) {
            // If anything fails during style change, log and keep existing map state
            console.error("Error changing map style:", e);
        }
    }, [mapStyle]);

    return (
        <div className="relative w-full h-full">
            {/* The div MapLibre renders into - must have explicit dimensions */}
            <div ref={mapContainer} className="w-full h-full" />
            <RouteLayer map={mapReady} userLocation={userLocation?.coords ?? null} />

            {/* Recenter, offered only once a manual pan has stopped the camera
                following. Sits above the route panel so it stays reachable.

                Fixed, not absolute. Its container is the map wrapper, which
                fills a `h-screen` root: on mobile browsers 100vh is the LARGE
                viewport, taller than what is actually on screen, because the
                address bar and the system nav bar overlay it. Measuring
                `bottom` from the foot of that box put the button underneath the
                browser chrome, so on a phone it was simply never visible, while
                on desktop, where the two viewports agree, it looked fine. The
                route panel is fixed and therefore anchored to the viewport the
                user can actually see, so the button has to be too or the two
                cannot stay a fixed distance apart.

                z-60 rather than z-10 for the same reason: the panel is z-50, so
                anything less means a wrong offset hides the button behind the
                sheet instead of merely misplacing it. */}
            {isNavigating && hasStartedNavigation && followPaused && (
                <ControlPill
                    className="fixed right-3 z-[60]"
                    style={{ bottom: `calc(${navPanelHeight}px + 1rem)` }}
                >
                    <ControlButton onClick={handleRecenter} title="Recenter on my location">
                        <LocateIcon />
                    </ControlButton>
                </ControlPill>
            )}

            {/* Controls float on top of the map - hide during navigation */}
            {!isNavigating && (
                <MapControls
                    onZoomIn={() => mapRef.current?.zoomIn()}
                    onZoomOut={() => mapRef.current?.zoomOut()}
                    onLocate={() => {
                        if (userLocation) {
                            mapRef.current?.flyTo({ center: userLocation.coords, zoom: 16, essential: true })
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(
                            (pos) => {
                                mapRef.current?.flyTo({
                                    center: [pos.coords.longitude, pos.coords.latitude],
                                    zoom: 16,
                                    essential: true,
                                });
                            },
                            () => {
                                mapRef.current?.flyTo({ center: UMN_CENTER, zoom: UMN_DEFAULT_ZOOM, essential: true });
                            },
                            MAP_GEOLOCATION_OPTIONS,
                        );
                    }}
                />
            )}
        </div>
    );
}
