import { useState } from "react";

import { type LayerId, useAppStore } from "../app/app-store";
import { compassSupported } from "../location/compass-mode";
import { togglePhoneLook } from "../location/phone-look";

const GUIDE_LABELS: ReadonlyArray<[LayerId, string]> = [
  ["orbit-lines", "Planet orbits"],
  ["ecliptic-rings", "Ecliptic plane"],
  ["moon-orbit", "Moon orbit"],
  ["sun-guide", "Sunlight direction"],
  ["earth-axis", "Earth axis & equator"],
  ["sky-grid", "Sky grid"],
  ["marker-labels", "Marker labels"],
  ["below-horizon-markers", "Below-horizon markers"],
];

/**
 * The header's one dialog: how to move, pointing with your phone, and the
 * optional guide geometry (SPEC §12 layers) with data credits.
 */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const layers = useAppStore((state) => state.layers);
  const setLayer = useAppStore((state) => state.setLayer);
  const phoneLookActive = useAppStore((state) => state.phoneLookActive);
  const [phoneLookStatus, setPhoneLookStatus] = useState<string | null>(null);

  if (!open) return null;

  const onPhoneLook = async () => {
    const changed = await togglePhoneLook();
    setPhoneLookStatus(
      changed ? null : "Device orientation is not available here or was declined.",
    );
  };

  return (
    <div className="intro-backdrop" role="presentation">
      <aside
        className="intro-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
        <span className="eyebrow">Plane of the solar system</span>
        <h2>Settings</h2>

        <section>
          <h3>How to move</h3>
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
        </section>

        {compassSupported() && (
          <section>
            <h3>Point with your phone</h3>
            <p className="settings-hint">Aim your phone at the sky and the view follows.</p>
            <button type="button" className="quiet-button" onClick={() => void onPhoneLook()}>
              {phoneLookActive ? "Compass mode on" : "Compass mode"}
            </button>
            {phoneLookStatus && <p className="location-hint">{phoneLookStatus}</p>}
          </section>
        )}

        <section>
          <h3>Guides</h3>
          <ul className="settings-guides">
            {GUIDE_LABELS.map(([layerId, label]) => (
              <li key={layerId}>
                <label>
                  <input
                    type="checkbox"
                    checked={layers[layerId]}
                    onChange={(event) => setLayer(layerId, event.currentTarget.checked)}
                  />
                  {label}
                </label>
              </li>
            ))}
          </ul>
        </section>

        <p className="layers-credits">
          Sky data: astronomy-engine (MIT) and the HYG star database (CC BY-SA 4.0). Earth imagery:
          NASA Blue Marble and Black Marble (NASA Earth Observatory). Moon imagery: NASA CGI Moon
          Kit (LRO). Place names: GeoNames (CC BY 4.0), matched on-device.
        </p>
      </aside>
    </div>
  );
}
