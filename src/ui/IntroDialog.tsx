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
          The real sky over your head, right now — and one control that pulls you out until the
          whole solar system assembles around you, always at true scale.
        </p>
        <ul className="intro-list">
          <li>
            <strong>Look around</strong> — drag the sky.
          </li>
          <li>
            <strong>Change scale</strong> — scroll, or ride the rail on the right from the ground
            to Pluto.
          </li>
          <li>
            <strong>Visit things</strong> — tap any marker to turn toward it and read its story.
          </li>
        </ul>
        <div className="intro-actions">
          {compassSupported() && (
            <button type="button" className="quiet-button" onClick={() => void onPhoneLook()}>
              {phoneLookActive ? "Phone look on" : "Point with phone"}
            </button>
          )}
          <label className="intro-motion">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.currentTarget.checked)}
            />
            Reduce camera motion
          </label>
        </div>
        {phoneLookStatus && <p className="location-hint">{phoneLookStatus}</p>}
        <button type="button" className="intro-begin" onClick={dismiss}>
          Step outside
        </button>
      </aside>
    </div>
  );
}
