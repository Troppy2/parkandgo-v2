/* Hook for keeping the device screen awake via the Screen Wake Lock API */

import { useEffect, useRef } from "react";

/**
 * Keeps the device screen awake while `enabled` is true.
 *
 * Uses the Screen Wake Lock API (navigator.wakeLock.request("screen")).
 * The browser automatically releases the lock when the page is hidden or
 * backgrounded, so a visibilitychange handler re-acquires it once the
 * document becomes visible again. This is what makes the lock feel
 * persistent across app switches.
 *
 * Requirements and fallbacks:
 * - Needs a secure context (HTTPS or localhost). Production runs on HTTPS.
 * - Degrades to a no-op where the API is unsupported (e.g. older iOS
 *   Safari). No crash, just no lock.
 */
export function useWakeLock(enabled: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator)) return;

    // Tracks whether this effect run has been cleaned up, so a lock that
    // resolves after cleanup is released instead of leaking.
    let cancelled = false;

    const requestLock = async () => {
      // Skip if we already hold an active lock (avoids duplicate sentinels
      // when visibilitychange fires while a lock is still live).
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
      } catch {
        // request() rejects if the document is not visible or the browser
        // refuses. Fail silently: this is a best-effort enhancement.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };

    void requestLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        void sentinel.release();
      }
    };
  }, [enabled]);
}
