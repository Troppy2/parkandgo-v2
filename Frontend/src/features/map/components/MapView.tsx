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
import MapControls from "./MapControls";
import RouteLayer from "./RouteLayer";
import { useEvents } from "../../events/hooks/useEvents";

const MAP_GEOLOCATION_OPTIONS = {
    maximumAge: 30000,
    timeout: 15000,
    enableHighAccuracy: false,
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
    const { data: events } = useEvents();
    const destination = useNavStore((s) => s.destination);
    const isNavigating = useNavStore((s) => s.isNavigating);
    const hasStartedNavigation = useNavStore((s) => s.hasStartedNavigation);
    const userLocation = useNavStore((s) => s.currentUserLocation);
    const setCurrentUserLocation = useNavStore((s) => s.setCurrentUserLocation);

    // All spots visible on the map — public endpoint, no auth required

    // Track event markers so we can remove them when tab switches
    const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
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
                () => {/* geolocation unavailable - map still works without it */},
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

            // Build a custom gold event pin element
            const el = document.createElement("div");
            el.className = "event-pin";
            el.style.cssText = `
                background: #FFCC33;
                color: #7A0019;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                min-width: 28px;
                min-height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 13px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                border: 2px solid #fff;
                cursor: pointer;
                box-sizing: border-box;
            `;
            el.innerHTML = `<i class="bi bi-calendar-event-fill" style="pointer-events: none;"></i>`;

            el.addEventListener("click", () => {
                mapRef.current?.flyTo({
                    center: eventCenter,
                    zoom: 17,
                    duration: 600,
                    essential: true,
                });
            });

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat(eventCenter)
                .setPopup(
                    new maplibregl.Popup({ offset: 16, closeButton: false })
                        .setHTML(`<strong style="font-size:12px">${event.title}</strong><br/><span style="font-size:11px;color:#666">${event.location_name ?? ""}</span>`)
                )
                .addTo(mapRef.current!);

            eventMarkersRef.current.push(marker);
        });
    }, [activeTab, events]);

    // Effect 3: Add/remove destination marker when navStore.destination changes
    useEffect(() => {
        // Remove previous destination marker
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;

        if (!destination || !mapRef.current) return;
        if (destination.longitude == null || destination.latitude == null) return;

        // SVG teardrop pin - points straight down, no rotation tricks
        const el = document.createElement("div");
        el.style.cssText = `
            width: 32px;
            height: 44px;
            cursor: pointer;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        `;
        el.innerHTML = `<svg viewBox="0 0 32 44" width="32" height="44" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="19" fill="rgba(122,0,25,0.18)"/>
            <path d="M16 2 C8.27 2 2 8.27 2 16 C2 25.5 16 44 16 44 C16 44 30 25.5 30 16 C30 8.27 23.73 2 16 2 Z" fill="#7A0019"/>
            <circle cx="16" cy="16" r="5" fill="white"/>
        </svg>`;

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

    // Effect 4: Add/remove user location marker when userLocation changes
    useEffect(() => {
        // Remove previous user location marker
        userLocationMarkerRef.current?.remove();
        userLocationMarkerRef.current = null;

        if (!userLocation || !mapRef.current) return;

        // Build the yellow arrow marker (UMN Gold) with fixed size
        const el = document.createElement("div");
        el.style.cssText = `
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            flex-shrink: 0;
        `;

        // Create SVG arrow that points north (up) with fixed dimensions
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 40 40");
        svg.setAttribute("width", "40");
        svg.setAttribute("height", "40");
        svg.style.cssText = `
            display: block;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
            transform: rotate(${userLocation.heading}deg);
            flex-shrink: 0;
        `;

        // Outer circle (white border)
        const outerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        outerCircle.setAttribute("cx", "20");
        outerCircle.setAttribute("cy", "20");
        outerCircle.setAttribute("r", "18");
        outerCircle.setAttribute("fill", "#FFCC33");
        outerCircle.setAttribute("stroke", "#fff");
        outerCircle.setAttribute("stroke-width", "2");
        svg.appendChild(outerCircle);

        // Arrow pointing up
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        arrow.setAttribute("points", "20,8 28,24 20,20 12,24");
        arrow.setAttribute("fill", "#fff");
        svg.appendChild(arrow);

        el.appendChild(svg);

        userLocationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
            .setLngLat(userLocation.coords)
            .addTo(mapRef.current);
    }, [userLocation]);

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
            map.setPitch(45);
            map.setBearing(-17.6);
            map.once("style.load", () => add3DBuildings(map));
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
