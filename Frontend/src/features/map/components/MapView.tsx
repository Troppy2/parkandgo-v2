import { useRef, useEffect } from "react";
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
import { snapToRoute } from "../../navigation/components/services/routingApi";
import MapControls from "./MapControls";
import RouteLayer from "./RouteLayer";
import { useEvents } from "../../events/hooks/useEvents";
import { useNearbyBuildings } from "../../campus/hooks/useCampusBuildings";
import { createTeardropPin, createUserLocationMarker } from "../../../lib/map/markerElements";

const MAP_GEOLOCATION_OPTIONS = {
    maximumAge: 5000,
    timeout: 15000,
    enableHighAccuracy: true,
} as const;

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
    const mapStyle = useUIStore((s) => s.mapStyle);
    const setMapInstance = useUIStore((s) => s.setMapInstance);

    const activeTab = useUIStore((s) => s.activeTab);
    const appMode = useUIStore((s) => s.appMode);
    const { data: events } = useEvents();
    const destination = useNavStore((s) => s.destination);
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
    // Track the user location marker
    const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
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

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            map.remove();
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

        // Fly map to the destination
        mapRef.current.flyTo({
            center: [destination.longitude, destination.latitude],
            zoom: 16,
            duration: 1000,
            essential: true,
        });
    }, [destination]);

    // Effect 4: Update user location marker when userLocation changes
    // Uses .setLngLat() + DOM updates instead of full marker recreation
    useEffect(() => {
        if (!userLocation || !mapRef.current) return;

        // Snap to road when driving and a route is loaded
        const displayCoords =
            isNavigating && travelMode === "driving" && route && route.coordinates.length > 1
                ? snapToRoute(userLocation.coords, route.coordinates)
                : userLocation.coords;

        // If marker doesn't exist, create it once
        if (!userLocationMarkerRef.current) {
            // Google/Apple Maps style dot + white ring + pulsing halo + heading cone
            const el = createUserLocationMarker();

            userLocationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
                .setLngLat(displayCoords)
                .addTo(mapRef.current);

            // Initial heading rotation
            const svg = el.querySelector('[data-heading-transform="true"]') as SVGElement | null;
            if (svg) svg.style.transform = `rotate(${userLocation.heading}deg)`;
        } else {
            // Marker exists: update position + rotation only (no DOM recreation)
            userLocationMarkerRef.current.setLngLat(displayCoords);

            // Update rotation via DOM query (avoids full element recreation)
            const markerEl = userLocationMarkerRef.current.getElement?.() ||
                document.querySelector('[data-user-location-marker="true"]');
            if (markerEl) {
                const svg = markerEl.querySelector('[data-heading-transform="true"]') as SVGElement;
                if (svg) {
                    svg.style.transform = `rotate(${userLocation.heading}deg)`;
                }
            }
        }
    }, [userLocation, isNavigating, travelMode, route]);

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

            if (loc && mapRef.current) {
                mapRef.current.flyTo({
                    center: loc.coords,
                    zoom: 16,
                    duration: 900,
                    essential: true,
                });
            } else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const nextLocation = {
                            coords: [pos.coords.longitude, pos.coords.latitude] as [number, number],
                            heading: pos.coords.heading ?? 0,
                        };

                        setCurrentUserLocation(nextLocation);
                        mapRef.current?.flyTo({
                            center: nextLocation.coords,
                            zoom: 16,
                            duration: 900,
                            essential: true,
                        });
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
            if (loc && mapRef.current) {
                mapRef.current.flyTo({
                    center: loc.coords,
                    zoom: 16,
                    duration: 800,
                    essential: true,
                });
            }
        }
        wasNavigatingRef.current = isNavigating;
    }, [isNavigating]);

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
            <RouteLayer map={mapRef.current} userLocation={userLocation?.coords ?? null} />

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
