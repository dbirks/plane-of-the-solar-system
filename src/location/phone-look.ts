import { useAppStore } from "../app/app-store";
import { type CompassStop, startCompass } from "./compass-mode";

let stopCompass: CompassStop | null = null;

const PHONE_LOOK_STORAGE_KEY = "plane-phone-look-v1";

function rememberPhoneLook(active: boolean): void {
  try {
    if (active) window.localStorage.setItem(PHONE_LOOK_STORAGE_KEY, "1");
    else window.localStorage.removeItem(PHONE_LOOK_STORAGE_KEY);
  } catch {
    // Private browsing: the toggle still works for this session.
  }
}

/**
 * Single shared phone-look session — the intro dialog and the observer chip
 * both toggle the same underlying orientation stream, with active state in
 * the app store. Resolves false when the device or permission refused. The
 * choice persists in local storage so a reload keeps tilt on.
 */
export async function togglePhoneLook(): Promise<boolean> {
  const store = useAppStore.getState();
  if (store.phoneLookActive) {
    stopCompass?.();
    stopCompass = null;
    store.setCompassLook(null, null);
    store.setPhoneLookActive(false);
    rememberPhoneLook(false);
    return true;
  }
  const stop = await startCompass((look) =>
    useAppStore.getState().setCompassLook(look.headingDeg, look.pitchDeg, look.quaternion),
  );
  if (!stop) return false;
  stopCompass = stop;
  store.setPhoneLookActive(true);
  rememberPhoneLook(true);
  return true;
}

/**
 * Startup: re-engage tilt when the user last left it on. On iOS the
 * permission prompt needs a user gesture, but a PREVIOUSLY GRANTED
 * permission resolves silently — and when it doesn't, the stored flag
 * stays put so the next explicit tap (or reload) picks it back up.
 */
export async function restorePhoneLook(): Promise<void> {
  try {
    if (window.localStorage.getItem(PHONE_LOOK_STORAGE_KEY) !== "1") return;
  } catch {
    return;
  }
  if (useAppStore.getState().phoneLookActive) return;
  await togglePhoneLook();
}
