// UMN Twin Cities campus center
// Note: MapLibre uses [longitude, latitude] order — opposite of Google Maps
export const UMN_CENTER: [number, number] = [-93.2277, 44.9740]
export const UMN_DEFAULT_ZOOM = 15.5

// ── Standard street map ──
export const STANDARD_STYLE = "https://tiles.openfreemap.org/styles/bright"

// ── 3D Buildings ──
export const BUILDINGS_3D_STYLE = "https://tiles.openfreemap.org/styles/bright"
// Same URL as standard — the extrusion layer gets added in code, not here

// ── Satellite ──
// ESRI World Imagery raster style
export const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution:
        'Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    }
  },
  layers: [
    {
      id: 'esri-layer',
      type: 'raster',
      source: 'esri-imagery',
      minzoom: 0,
      maxzoom: 22
    }
  ]
}

// Twin Cities Metro bounding box [west, south, east, north]
// This covers Minneapolis, St. Paul, and surrounding suburbs
export const TWIN_CITIES_METRO_BOUNDS: [number, number, number, number] = [
  -93.6500,  // west  (past Plymouth/Minnetonka)
  44.7800,   // south (past Burnsville/Eagan)
  -92.9500,  // east  (past Woodbury/Stillwater)
  45.1500,   // north (past Blaine/Coon Rapids)
]