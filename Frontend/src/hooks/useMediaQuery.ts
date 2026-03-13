import { useState, useEffect } from "react";

export function useMediaQuery(query: string) {
  // 1. Create state: const [matches, setMatches] = useState(false)
  const [matches, setMatches] = useState(false);

  // 2. useEffect:
  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // handler for change events
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    media.addEventListener("change", handler);

    //  Return cleanup
    return () => media.removeEventListener("change", handler);
  }, [query]);

  // 3. Return matches
  return matches;
}
