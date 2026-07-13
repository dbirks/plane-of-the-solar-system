/**
 * Optional device-compass alignment (SPEC §24): progressive enhancement, only
 * ever started from an explicit user tap, and degrading gracefully when the
 * device or permission is unavailable.
 */

export function compassSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

type OrientationEventLike = {
  alpha: number | null;
  beta?: number | null;
  gamma?: number | null;
  absolute?: boolean;
  webkitCompassHeading?: number;
};

/**
 * Compass heading (degrees clockwise from north) from a device-orientation
 * event, or null when the event carries no usable heading.
 */
export function headingFromOrientationEvent(event: OrientationEventLike): number | null {
  if (typeof event.webkitCompassHeading === "number") {
    // iOS reports the compass heading directly.
    return ((event.webkitCompassHeading % 360) + 360) % 360;
  }
  if (event.alpha === null || event.absolute === false) return null;
  // Absolute alpha is measured counterclockwise from north.
  return (((360 - event.alpha) % 360) + 360) % 360;
}

export type OrientationLook = {
  /** Degrees clockwise from north of the through-the-screen gaze. */
  headingDeg: number;
  /** Degrees above the horizon of that gaze (−90 ground, +90 zenith). */
  pitchDeg: number | null;
};

const DEG = Math.PI / 180;

/**
 * Where the device is pointing — the direction "through the screen", i.e.
 * what the back camera sees — from a device-orientation event, so pointing
 * the phone at the sky looks there. Uses the W3C Z-X'-Y'' rotation (world
 * frame: X east, Y north, Z up). Pitch is independent of alpha, so it stays
 * valid on iOS where alpha is relative and the compass heading is separate.
 */
export function lookFromOrientationEvent(event: OrientationEventLike): OrientationLook | null {
  const headingDeg = headingFromOrientationEvent(event);
  if (headingDeg === null) return null;
  if (typeof event.beta !== "number" || typeof event.gamma !== "number") {
    return { headingDeg, pitchDeg: null };
  }
  const cosBeta = Math.cos(event.beta * DEG);
  const cosGamma = Math.cos(event.gamma * DEG);
  // gaze_world = R(alpha, beta, gamma) · (0, 0, −1); its up-component is
  // −cos(beta)·cos(gamma) regardless of alpha.
  const upComponent = -cosBeta * cosGamma;
  const pitchDeg = Math.asin(Math.min(1, Math.max(-1, upComponent))) / DEG;
  return { headingDeg, pitchDeg };
}

export type CompassStop = () => void;

/**
 * Request permission if the platform demands it, then stream the device look
 * direction. Resolves null when unsupported or denied.
 */
export async function startCompass(
  onLook: (look: OrientationLook) => void,
): Promise<CompassStop | null> {
  if (!compassSupported()) return null;
  const eventConstructor = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof eventConstructor.requestPermission === "function") {
    try {
      const decision = await eventConstructor.requestPermission();
      if (decision !== "granted") return null;
    } catch {
      return null;
    }
  }
  const listener = (event: DeviceOrientationEvent) => {
    const look = lookFromOrientationEvent(event as unknown as OrientationEventLike);
    if (look !== null) onLook(look);
  };
  window.addEventListener("deviceorientationabsolute", listener as EventListener);
  window.addEventListener("deviceorientation", listener as EventListener);
  return () => {
    window.removeEventListener("deviceorientationabsolute", listener as EventListener);
    window.removeEventListener("deviceorientation", listener as EventListener);
  };
}
