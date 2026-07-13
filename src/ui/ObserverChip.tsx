import { useRef, useState } from "react";

import { useAppStore } from "../app/app-store";
import { type CompassStop, compassSupported, startCompass } from "../location/compass-mode";
import {
  clearSavedObserver,
  type ObserverLocation,
  saveObserver,
} from "../location/observer-location";

/** Reload with explicit lat/lon so the location stays a reproducible URL state. */
function navigateWithLocation(latitudeDeg: number, longitudeDeg: number): void {
  const params = new URLSearchParams(window.location.search);
  params.set("lat", latitudeDeg.toFixed(4));
  params.set("lon", longitudeDeg.toFixed(4));
  window.location.search = params.toString();
}

const SOURCE_HINTS: Record<ObserverLocation["source"], string> = {
  url: "From the page address",
  saved: "Your saved default",
  timezone: "Guessed from your timezone — approximate is fine for the sky",
  fallback: "Default location",
};

export function ObserverChip({
  observer,
  facingLabel,
}: {
  observer: ObserverLocation;
  facingLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [latitudeInput, setLatitudeInput] = useState(observer.latitudeDeg.toFixed(4));
  const [longitudeInput, setLongitudeInput] = useState(observer.longitudeDeg.toFixed(4));
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [compassActive, setCompassActive] = useState(false);
  const compassStopRef = useRef<CompassStop | null>(null);
  const setCompassLook = useAppStore((state) => state.setCompassLook);

  const toggleCompass = async () => {
    if (compassActive) {
      compassStopRef.current?.();
      compassStopRef.current = null;
      setCompassLook(null, null);
      setCompassActive(false);
      return;
    }
    const stop = await startCompass((look) => setCompassLook(look.headingDeg, look.pitchDeg));
    if (!stop) {
      setGeoStatus("Device orientation is not available on this device or was declined.");
      return;
    }
    compassStopRef.current = stop;
    setCompassActive(true);
  };

  const facingText =
    facingLabel === null
      ? ""
      : facingLabel === "South"
        ? "Facing south · "
        : `Facing the ${facingLabel} · `;

  const applyManual = () => {
    const latitudeDeg = Number(latitudeInput);
    const longitudeDeg = Number(longitudeInput);
    if (
      !Number.isFinite(latitudeDeg) ||
      !Number.isFinite(longitudeDeg) ||
      Math.abs(latitudeDeg) > 90 ||
      Math.abs(longitudeDeg) > 180
    ) {
      setGeoStatus("Enter a latitude within ±90 and a longitude within ±180.");
      return;
    }
    navigateWithLocation(latitudeDeg, longitudeDeg);
  };

  const useDeviceLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("This browser does not offer location access.");
      return;
    }
    setGeoStatus("Asking the browser for your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        navigateWithLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setGeoStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was declined — the approximate sky still works."
            : "Could not read a location from this device.",
        );
      },
      { timeout: 10_000 },
    );
  };

  const saveDefault = () => {
    saveObserver(window.localStorage, {
      latitudeDeg: observer.latitudeDeg,
      longitudeDeg: observer.longitudeDeg,
      label: observer.label,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  };

  return (
    <div className="observer-chip-wrap">
      <button
        type="button"
        className="observer-label observer-label--button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="pulse-dot" />
        {facingText}
        {observer.label}
      </button>

      {open && (
        <aside className="location-panel" aria-label="Observer location">
          <span className="eyebrow">Observer location</span>
          <p className="location-hint">{SOURCE_HINTS[observer.source]}</p>
          <div className="location-inputs">
            <label>
              Latitude
              <input
                value={latitudeInput}
                onChange={(event) => setLatitudeInput(event.currentTarget.value)}
                inputMode="decimal"
                aria-label="Latitude in degrees"
              />
            </label>
            <label>
              Longitude
              <input
                value={longitudeInput}
                onChange={(event) => setLongitudeInput(event.currentTarget.value)}
                inputMode="decimal"
                aria-label="Longitude in degrees"
              />
            </label>
          </div>
          <div className="location-actions">
            <button type="button" className="quiet-button" onClick={applyManual}>
              Go here
            </button>
            <button type="button" className="quiet-button" onClick={useDeviceLocation}>
              Use device location
            </button>
            {compassSupported() && (
              <button type="button" className="quiet-button" onClick={() => void toggleCompass()}>
                {compassActive ? "Phone look on" : "Point with phone"}
              </button>
            )}
            <button type="button" className="quiet-button" onClick={saveDefault}>
              {savedFlash ? "Saved" : "Save as default"}
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={() => {
                clearSavedObserver(window.localStorage);
                setGeoStatus("Saved default cleared.");
              }}
            >
              Clear saved
            </button>
          </div>
          {geoStatus && <p className="location-status">{geoStatus}</p>}
          <p className="location-privacy">
            Your location is only used in this browser to orient the sky. Nothing is sent anywhere,
            and precise device location is read only when you tap the button above.
          </p>
        </aside>
      )}
    </div>
  );
}
