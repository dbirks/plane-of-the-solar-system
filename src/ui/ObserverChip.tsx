import { useMemo, useState } from "react";

import { useAppStore } from "../app/app-store";
import { compassSupported } from "../location/compass-mode";
import { nearestPlace } from "../location/nearest-place";
import { togglePhoneLook } from "../location/phone-look";
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
  timezone: "Guessed from your timezone. Approximate is fine for the sky",
  fallback: "Default location",
};

export function ObserverChip({ observer }: { observer: ObserverLocation }) {
  const [open, setOpen] = useState(false);
  const [latitudeInput, setLatitudeInput] = useState(observer.latitudeDeg.toFixed(4));
  const [longitudeInput, setLongitudeInput] = useState(observer.longitudeDeg.toFixed(4));
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const compassActive = useAppStore((state) => state.phoneLookActive);

  const toggleCompass = async () => {
    const changed = await togglePhoneLook();
    if (!changed) {
      setGeoStatus("Device orientation is not available on this device or was declined.");
    }
  };

  // A coarse, familiar anchor ("Near Indianapolis, IN") instead of raw
  // coordinates — friendlier and narrower on small screens. The exact
  // numbers stay available in the expanded panel.
  const placeText = useMemo(() => {
    const place = nearestPlace(observer.latitudeDeg, observer.longitudeDeg);
    return place ? `Near ${place.label}` : observer.label;
  }, [observer.latitudeDeg, observer.longitudeDeg, observer.label]);

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
            ? "Location permission was declined. The approximate sky still works."
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
        {placeText}
      </button>

      {open && (
        <aside className="location-panel" aria-label="Observer location">
          <span className="eyebrow">Where you are</span>
          <p className="location-hint">{SOURCE_HINTS[observer.source]}</p>
          <div className="location-actions">
            <button type="button" className="quiet-button" onClick={useDeviceLocation}>
              Use my location
            </button>
            {compassSupported() && (
              <button type="button" className="quiet-button" onClick={() => void toggleCompass()}>
                {compassActive ? "Compass mode on" : "Compass mode"}
              </button>
            )}
          </div>

          <span className="eyebrow location-section">Or enter coordinates</span>
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
            <button type="button" className="quiet-button" onClick={applyManual}>
              Go here
            </button>
          </div>

          <div className="location-actions location-remember">
            <button type="button" className="quiet-button" onClick={saveDefault}>
              {savedFlash ? "Remembered" : "Remember this spot"}
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={() => {
                clearSavedObserver(window.localStorage);
                setGeoStatus("Forgotten. Next visit starts fresh.");
              }}
            >
              Forget
            </button>
          </div>
          {geoStatus && <p className="location-status">{geoStatus}</p>}
          <p className="location-privacy">
            Your location stays in this browser, only to orient the sky. Nothing is sent anywhere.
          </p>
        </aside>
      )}
    </div>
  );
}
