import { useState } from "react";

import { compassSupported } from "../location/compass-mode";
import { togglePhoneLook } from "../location/phone-look";

export const INTRO_STORAGE_KEY = "pss-intro-dismissed";

/**
 * A brief welcome before the sky. Shows on a visitor's first plain visit
 * (reproducible ?time/?lat URLs skip it). On phones it offers the device
 * tilt permission up front — the browser prompt needs a tap, and this is
 * the honest place to explain it — while Continue always works without.
 */
export function IntroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tiltStatus, setTiltStatus] = useState<string | null>(null);

  if (!open) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode) — the dialog just reopens.
    }
    onClose();
  };

  const enableTilt = async () => {
    const changed = await togglePhoneLook();
    if (changed) {
      dismiss();
    } else {
      setTiltStatus("No motion access here. You can still drag to look around.");
    }
  };

  return (
    <div className="intro-backdrop" role="presentation">
      <aside className="intro-dialog" role="dialog" aria-modal="true" aria-label="Welcome">
        <span className="eyebrow">Welcome to</span>
        <h2>Plane of the Solar System</h2>
        <p>
          This is tonight's actual sky over where you stand. Pull away from the ground and let
          your sense of up reset: the plane of the solar system holds flat while your ground
          tilts, and it slowly sinks in that you have been standing on the side of a planet.
        </p>
        <ul className="intro-list">
          <li>
            <strong>Drag</strong> to look around the sky.
          </li>
          <li>
            <strong>Scroll</strong> (or use the rail on the right) to leave the ground.
          </li>
        </ul>
        {compassSupported() && (
          <p className="intro-permission-note">
            Pointing your phone at the sky is the best way to explore. Your browser will ask for
            motion access once.
          </p>
        )}
        {tiltStatus && <p className="location-hint">{tiltStatus}</p>}
        <div className="intro-buttons">
          {compassSupported() && (
            <button type="button" className="intro-begin" onClick={() => void enableTilt()}>
              Point with your phone
            </button>
          )}
          <button type="button" className="intro-continue" onClick={dismiss}>
            Continue
          </button>
        </div>
      </aside>
    </div>
  );
}
