import { useState } from "react";

import { useAppStore } from "../app/app-store";
import { compassSupported } from "../location/compass-mode";
import { togglePhoneLook } from "../location/phone-look";

export const INTRO_STORAGE_KEY = "pss-intro-dismissed";

/**
 * A brief welcome before the sky: what this is and how to move. Shows on a
 * visitor's first plain visit (reproducible ?time/?lat URLs skip it) and
 * reopens from the header's About button. Houses the phone-look toggle and
 * the reduced-motion preference so both are discoverable.
 */
export function IntroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const phoneLookActive = useAppStore((state) => state.phoneLookActive);
  const [phoneLookStatus, setPhoneLookStatus] = useState<string | null>(null);

  if (!open) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode) — the dialog just reopens.
    }
    onClose();
  };

  const onPhoneLook = async () => {
    const changed = await togglePhoneLook();
    setPhoneLookStatus(
      changed ? null : "Device orientation is not available here or was declined.",
    );
  };

  return (
    <div className="intro-backdrop" role="presentation">
      <aside className="intro-dialog" role="dialog" aria-modal="true" aria-label="Welcome">
        <span className="eyebrow">Welcome to</span>
        <h2>Plane of the Solar System</h2>
        <p>
          This is tonight's actual sky. Everything is where it really is, at its real size and
          distance, and you can zoom all the way out to Pluto.
        </p>
        <ul className="intro-list">
          <li>
            <strong>Drag</strong> to look around the sky.
          </li>
          <li>
            <strong>Scroll</strong> (or use the rail on the right) to leave the ground.
          </li>
          <li>
            <strong>Tap a marker</strong> to turn toward that body and read about it.
          </li>
        </ul>
        <div className="intro-actions">
          {compassSupported() && (
            <button type="button" className="quiet-button" onClick={() => void onPhoneLook()}>
              {phoneLookActive ? "Compass mode on" : "Compass mode"}
            </button>
          )}
          <label className="intro-motion">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.currentTarget.checked)}
            />
            Gentler camera (less motion)
          </label>
        </div>
        {phoneLookStatus && <p className="location-hint">{phoneLookStatus}</p>}
        <button type="button" className="intro-begin" onClick={dismiss}>
          Continue
        </button>
      </aside>
    </div>
  );
}
