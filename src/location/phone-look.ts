import { useAppStore } from "../app/app-store";
import { type CompassStop, startCompass } from "./compass-mode";

let stopCompass: CompassStop | null = null;

/**
 * Single shared phone-look session — the intro dialog and the observer chip
 * both toggle the same underlying orientation stream, with active state in
 * the app store. Resolves false when the device or permission refused.
 */
export async function togglePhoneLook(): Promise<boolean> {
  const store = useAppStore.getState();
  if (store.phoneLookActive) {
    stopCompass?.();
    stopCompass = null;
    store.setCompassLook(null, null);
    store.setPhoneLookActive(false);
    return true;
  }
  const stop = await startCompass((look) =>
    useAppStore.getState().setCompassLook(look.headingDeg, look.pitchDeg),
  );
  if (!stop) return false;
  stopCompass = stop;
  store.setPhoneLookActive(true);
  return true;
}
