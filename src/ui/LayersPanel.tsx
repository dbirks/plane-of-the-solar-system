import { useState } from "react";

import { type LayerId, useAppStore } from "../app/app-store";

const LAYER_LABELS: ReadonlyArray<[LayerId, string]> = [
  ["orbit-lines", "Planet orbits"],
  ["ecliptic-rings", "Ecliptic plane rings"],
  ["moon-orbit", "Moon orbit"],
  ["sun-guide", "Sunlight direction"],
  ["earth-axis", "Earth axis & equator"],
  ["sky-grid", "Sky grid"],
  ["marker-labels", "Marker labels"],
  ["below-horizon-markers", "Below-horizon markers"],
];

/** Optional explanation layers (SPEC §12): geometry stays sparse by default. */
export function LayersPanel() {
  const [open, setOpen] = useState(false);
  const layers = useAppStore((state) => state.layers);
  const setLayer = useAppStore((state) => state.setLayer);

  return (
    <>
      <button
        type="button"
        className="quiet-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Layers
      </button>
      {open && (
        <aside className="layers-panel" aria-label="Explanation layers">
          <span className="eyebrow">Layers</span>
          <ul>
            {LAYER_LABELS.map(([layerId, label]) => (
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
          <p className="layers-credits">
            Sky data: astronomy-engine (MIT) and the HYG star database (CC BY-SA 4.0). Earth
            imagery: NASA Blue Marble and Black Marble (NASA Earth Observatory).
          </p>
        </aside>
      )}
    </>
  );
}
