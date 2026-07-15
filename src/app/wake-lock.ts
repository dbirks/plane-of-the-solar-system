/**
 * Keep the screen awake while stargazing (SPEC: calm, uninterrupted watching).
 * Progressive enhancement: acquired on the first interaction (browsers demand
 * a gesture or visibility), re-acquired when the tab returns to view, and
 * silently absent where the Wake Lock API is unsupported.
 */
export function installWakeLock(): void {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

  const acquire = async () => {
    try {
      await navigator.wakeLock.request("screen");
    } catch {
      // Denied (e.g. battery saver) — the sky still works, the screen may nap.
    }
  };

  window.addEventListener("pointerdown", () => void acquire(), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void acquire();
  });
}
