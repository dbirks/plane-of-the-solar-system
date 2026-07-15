import { useState } from "react";

import { type LayerId, useAppStore } from "../app/app-store";
import { compassSupported } from "../location/compass-mode";
import { togglePhoneLook } from "../location/phone-look";

const GUIDES: ReadonlyArray<[LayerId, string, string]> = [
  ["orbit-lines", "Planet orbits", "Each planet's path around the Sun."],
  ["ecliptic-rings", "Ecliptic plane", "The flat plane the planets ride, at every scale."],
  ["moon-orbit", "Moon orbit", "The Moon's real path around Earth."],
  ["sun-guide", "Sunlight direction", "A line from Earth toward the Sun."],
  ["axis-stubs", "Earth tilt", "Small axis lines above and below the poles."],
  ["earth-axis", "Earth axis & equator", "The full spin axis and equator drawn on the globe."],
  ["sky-grid", "Sky grid", "Altitude and azimuth lines over the sky."],
  ["marker-labels", "Marker labels", "Names beside the body markers."],
  ["below-horizon-markers", "Below-horizon markers", "Keep markers for bodies under the horizon."],
];

/**
 * The header's one dialog: how to move, pointing with your phone, and the
 * optional guide geometry (SPEC §12 layers) with data credits. The title row
 * stays pinned while the body scrolls.
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
        <header className="settings-header">
          <div>
            <span className="eyebrow">Plane of the solar system</span>
            <h2>Settings</h2>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <div className="settings-body">
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
              {GUIDES.map(([layerId, label, description]) => (
                <li key={layerId}>
                  <label className="guide-row">
                    <span className="guide-text">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <input
                      type="checkbox"
                      className="switch-input"
                      checked={layers[layerId]}
                      onChange={(event) => setLayer(layerId, event.currentTarget.checked)}
                    />
                    <span className="switch-track" aria-hidden="true">
                      <span className="switch-knob" />
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Data &amp; imagery</h3>
            <ul className="credits-list">
              <li>
                Sky:{" "}
                <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noreferrer">
                  astronomy-engine
                </a>{" "}
                (MIT) and the{" "}
                <a
                  href="https://github.com/astronexus/HYG-Database"
                  target="_blank"
                  rel="noreferrer"
                >
                  HYG star database
                </a>{" "}
                (CC BY-SA 4.0)
              </li>
              <li>
                Earth: NASA{" "}
                <a
                  href="https://earthobservatory.nasa.gov/features/BlueMarble"
                  target="_blank"
                  rel="noreferrer"
                >
                  Blue Marble
                </a>{" "}
                and{" "}
                <a
                  href="https://earthobservatory.nasa.gov/features/NightLights"
                  target="_blank"
                  rel="noreferrer"
                >
                  Black Marble
                </a>
              </li>
              <li>
                Moon: NASA{" "}
                <a href="https://svs.gsfc.nasa.gov/4720" target="_blank" rel="noreferrer">
                  CGI Moon Kit
                </a>{" "}
                (LRO)
              </li>
              <li>
                Planets:{" "}
                <a
                  href="https://www.solarsystemscope.com/textures/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Solar System Scope
                </a>{" "}
                textures (CC BY 4.0); Pluto:{" "}
                <a
                  href="https://www.jpl.nasa.gov/images/pia11707-pluto-color-map/"
                  target="_blank"
                  rel="noreferrer"
                >
                  NASA New Horizons
                </a>{" "}
                (NASA/JHUAPL/SwRI)
              </li>
              <li>
                Places:{" "}
                <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
                  GeoNames
                </a>{" "}
                (CC BY 4.0), matched on-device
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
