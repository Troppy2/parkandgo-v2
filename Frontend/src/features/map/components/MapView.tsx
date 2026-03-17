import { useRef, useEffect, useState } from "react";
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
    const mapStyle = useUIStore((s) => s.mapStyle);
    const setMapInstance = useUIStore((s) => s.setMapInstance);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    const activeTab = useUIStore((s) => s.activeTab);
    const { data: events } = useEvents();
    const destination = useNavStore((s) => s.destination);

    // Track event markers so we can remove them when tab switches
    const eventMarkersRef = useRef<maplibregl.Marker[]>([]);
    // Track the single destination marker
    const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);

    // ── Effect 1: Initialize map ONCE on mount ──
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
                (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
                () => {/* geolocation unavailable — map still works without it */},
                { maximumAge: 10000, timeout: 5000, enableHighAccuracy: true },
            );
        }

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            map.remove();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Effect 2: Add/remove event pins when tab or events data changes ──
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing event markers first
        eventMarkersRef.current.forEach((m) => m.remove());
        eventMarkersRef.current = [];

        // Only add event pins when Events tab is active
        if (activeTab !== "events" || !events) return;

        events.forEach((event) => {
            if (!event.latitude || !event.longitude) return;

            // Build a custom gold event pin element
            const el = document.createElement("div");
            el.className = "event-pin";
            el.innerHTML = `<i class="bi bi-calendar-event-fill"></i>`;
            el.style.cssText = `
                background: #FFCC33;
                color: #7A0019;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 13px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                border: 2px solid #fff;
                cursor: pointer;
            `;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([event.longitude, event.latitude])
                .addTo(mapRef.current!);

            eventMarkersRef.current.push(marker);
        });
    }, [activeTab, events]);

    // ── Effect 3: Add/remove destination marker when navStore.destination changes ──
    useEffect(() => {
        // Remove previous destination marker
        destinationMarkerRef.current?.remove();
        destinationMarkerRef.current = null;

        if (!destination || !mapRef.current) return;
        if (!destination.longitude || !destination.latitude) return;

        // Build the maroon pin element that matches the design (.pin-head style)
        const el = document.createElement("div");
        el.style.cssText = `
            width: 34px;
            height: 34px;
            background: #7A0019;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 0 0 6px rgba(122,0,25,0.18);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        `;
        const inner = document.createElement("div");
        inner.style.cssText = `
            width: 13px;
            height: 13px;
            background: #fff;
            border-radius: 50%;
            transform: rotate(45deg);
        `;
        el.appendChild(inner);

        destinationMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom-left" })
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

    // ── Effect 5: React to style changes from uiStore ──
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
            {/* The div MapLibre renders into — must have explicit dimensions */}
            <div ref={mapContainer} className="w-full h-full" />
            <RouteLayer map={mapRef.current} userLocation={userLocation} />

            {/* Controls float on top of the map */}
            <MapControls
                onZoomIn={() => mapRef.current?.zoomIn()}
                onZoomOut={() => mapRef.current?.zoomOut()}
                onLocate={() => {
                    if (userLocation) {
                        mapRef.current?.flyTo({ center: userLocation, zoom: 16, essential: true })
                        return
                    }
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            mapRef.current?.flyTo({
                                center: [pos.coords.longitude, pos.coords.latitude],
                                zoom: 16,
                                essential: true,
                            })
                        },
                        () => {
                            mapRef.current?.flyTo({ center: UMN_CENTER, zoom: UMN_DEFAULT_ZOOM, essential: true })
                        },
                        { maximumAge: 10000, timeout: 5000, enableHighAccuracy: true },
                    )
                }}
            />
        </div>
    );
}
