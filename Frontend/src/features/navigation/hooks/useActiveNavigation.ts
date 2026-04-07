import { useEffect } from "react";
import { useNavStore } from "../../../store/navStore";
import { isUserNearArrival } from "../components/services/routingApi";

const AUTO_END_THRESHOLD_METERS = 15;

/**
 * Handles auto-end: ends navigation when the user reaches the destination.
 *
 * Intentionally narrow — it only does what nothing else already handles:
 * - Stats updates and ETA are handled by ETAIndicator
 * - Step advancement is handled by ETAIndicator
 * - Route line drawing is handled by RouteLayer
 * - GPS watching is handled by MapView's persistent watchPosition
 *
 * Reads currentUserLocation from the store (already updated by MapView)
 * rather than registering its own watchPosition, avoiding duplicate watchers
 * and the re-render loop that came from having `route` in the dependency array.
 */
export function useActiveNavigation() {
  const isNavigating = useNavStore((s) => s.isNavigating);
  const hasStartedNavigation = useNavStore((s) => s.hasStartedNavigation);
  const destination = useNavStore((s) => s.destination);
  const currentUserLocation = useNavStore((s) => s.currentUserLocation);
  const endNavigation = useNavStore((s) => s.endNavigation);
  const promptRememberSpot = useNavStore((s) => s.promptRememberSpot);

  useEffect(() => {
    if (!isNavigating || !hasStartedNavigation || !destination || !currentUserLocation) return;
    if (destination.latitude == null || destination.longitude == null) return;

    const [userLng, userLat] = currentUserLocation.coords;

    if (
      isUserNearArrival(
        userLng,
        userLat,
        destination.longitude,
        destination.latitude,
        AUTO_END_THRESHOLD_METERS
      )
    ) {
      promptRememberSpot(destination);
      endNavigation();
    }
  }, [isNavigating, hasStartedNavigation, destination, currentUserLocation, endNavigation, promptRememberSpot]);
}
