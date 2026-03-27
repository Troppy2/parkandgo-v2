declare module "@mapbox/polyline" {
  export function decode(encodedPath: string, precision?: number): [number, number][];
  export function encode(coordinates: [number, number][], precision?: number): string;
  export function fromGeoJSON(
    geojson: {
      type: "Feature";
      geometry: {
        type: "LineString";
        coordinates: [number, number][];
      };
      properties?: Record<string, unknown>;
    },
    precision?: number,
  ): string;

  const polyline: {
    decode: typeof decode;
    encode: typeof encode;
    fromGeoJSON: typeof fromGeoJSON;
  };

  export default polyline;
}
