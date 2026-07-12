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

export type CompassStop = () => void;

/**
 * Request permission if the platform demands it, then stream compass headings.
 * Resolves null when unsupported or denied.
 */
export async function startCompass(
  onHeading: (headingDeg: number) => void,
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
    const heading = headingFromOrientationEvent(event as unknown as OrientationEventLike);
    if (heading !== null) onHeading(heading);
  };
  window.addEventListener("deviceorientationabsolute", listener as EventListener);
  window.addEventListener("deviceorientation", listener as EventListener);
  return () => {
    window.removeEventListener("deviceorientationabsolute", listener as EventListener);
    window.removeEventListener("deviceorientation", listener as EventListener);
  };
}
