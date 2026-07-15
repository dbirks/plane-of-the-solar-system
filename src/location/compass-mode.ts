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
  /**
   * Full camera attitude in the local Three frame (x east, y up, z south),
   * as quaternion components [x, y, z, w]. Unlike heading+pitch this stays
   * well-defined pointing straight up — no flip at the zenith — so the
   * renderer prefers it when present.
   */
  quaternion: [number, number, number, number] | null;
};

const DEG = Math.PI / 180;

type Quat = [number, number, number, number];

function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function quatFromAxisAngle(x: number, y: number, z: number, angleRad: number): Quat {
  const half = angleRad / 2;
  const s = Math.sin(half);
  return [x * s, y * s, z * s, Math.cos(half)];
}

function rotateVector(q: Quat, v: readonly [number, number, number]): [number, number, number] {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  // t = 2 q × v; v' = v + qw t + q × t
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + qy * tz - qz * ty,
    vy + qw * ty + qz * tx - qx * tz,
    vz + qw * tz + qx * ty - qy * tx,
  ];
}

function wrapRad(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Full device attitude as a camera quaternion in the local Three frame
 * (x east, y up, z south): the W3C Z-X'-Y'' angles composed as a YXZ
 * quaternion, turned to look out the BACK of the device, compensated for
 * screen orientation. This is the DeviceOrientationControls construction —
 * the standard fix for the Euler gimbal lock that makes heading+pitch sky
 * apps spin wildly at the zenith. Yaw is in alpha's (possibly arbitrary)
 * reference; callers align it to the platform compass heading.
 */
export function attitudeQuaternionFromEvent(
  event: OrientationEventLike,
  screenOrientationDeg: number,
): Quat | null {
  if (event.alpha === null || typeof event.beta !== "number" || typeof event.gamma !== "number") {
    return null;
  }
  const qYaw = quatFromAxisAngle(0, 1, 0, event.alpha * DEG);
  const qPitch = quatFromAxisAngle(1, 0, 0, event.beta * DEG);
  const qRoll = quatFromAxisAngle(0, 0, 1, -event.gamma * DEG);
  let q = quatMultiply(quatMultiply(qYaw, qPitch), qRoll);
  q = quatMultiply(q, quatFromAxisAngle(1, 0, 0, -Math.PI / 2));
  q = quatMultiply(q, quatFromAxisAngle(0, 0, 1, -screenOrientationDeg * DEG));
  return q;
}

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
    return { headingDeg, pitchDeg: null, quaternion: null };
  }
  const cosBeta = Math.cos(event.beta * DEG);
  const cosGamma = Math.cos(event.gamma * DEG);
  // gaze_world = R(alpha, beta, gamma) · (0, 0, −1); its up-component is
  // −cos(beta)·cos(gamma) regardless of alpha.
  const upComponent = -cosBeta * cosGamma;
  const pitchDeg = Math.asin(Math.min(1, Math.max(-1, upComponent))) / DEG;
  return { headingDeg, pitchDeg, quaternion: null };
}

export type CompassStop = () => void;

/**
 * Opt-in live overlay (?compassdebug=1) so on-device misbehavior can be
 * screenshotted with the raw sensor numbers attached.
 */
function createCompassDebugOverlay(): HTMLPreElement | null {
  if (typeof window === "undefined") return null;
  if (!new URLSearchParams(window.location.search).has("compassdebug")) return null;
  let element = document.getElementById("compass-debug") as HTMLPreElement | null;
  if (!element) {
    element = document.createElement("pre");
    element.id = "compass-debug";
    element.style.cssText =
      "position:fixed;left:8px;top:88px;z-index:99;margin:0;padding:8px 10px;" +
      "background:rgba(1,10,16,0.8);color:#9fe0a8;font:11px/1.5 monospace;" +
      "border-radius:8px;pointer-events:none;white-space:pre;";
    document.body.appendChild(element);
  }
  return element;
}

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
  // Magnetometer yaw calibration for the attitude quaternion: alpha's zero
  // is arbitrary on iOS and drifts, so the quaternion's azimuth is aligned
  // to the platform compass heading. The calibration is deliberately
  // paranoid — the compass reference itself can BRANCH-FLIP by 180° as the
  // device tips past upright (an artifact of the Euler decomposition, not a
  // real turn), which is exactly the "spins around at the top of the sky"
  // bug. So: only sample it near level attitudes, track it slowly, and
  // reject any jump too large to be drift; the quaternion carries the view
  // smoothly through the zenith on pure geometry in between.
  let yawCorrectionRad: number | null = null;
  let rejectedInARow = 0;
  // Android fires BOTH deviceorientationabsolute and deviceorientation;
  // mixing the two alpha references whipsaws the view. Absolute wins.
  let sawAbsolute = false;
  const debugElement = createCompassDebugOverlay();
  const listener = (event: DeviceOrientationEvent) => {
    if (event.type === "deviceorientationabsolute") sawAbsolute = true;
    else if (sawAbsolute) return;
    const eventLike = event as unknown as OrientationEventLike;
    const look = lookFromOrientationEvent(eventLike);
    const screenOrientationDeg =
      typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0;
    const attitude = attitudeQuaternionFromEvent(eventLike, screenOrientationDeg);
    if (attitude) {
      const gaze = rotateVector(attitude, [0, 0, -1]);
      const azimuthRad = Math.atan2(gaze[0], -gaze[2]);
      const pitchDeg = Math.asin(Math.min(1, Math.max(-1, gaze[1]))) / DEG;
      const platformHeadingDeg = headingFromOrientationEvent(eventLike);
      if (platformHeadingDeg !== null && Math.abs(pitchDeg) < 30) {
        const target = wrapRad(azimuthRad - platformHeadingDeg * DEG);
        if (yawCorrectionRad === null) {
          yawCorrectionRad = target;
        } else {
          const delta = wrapRad(target - yawCorrectionRad);
          // Drift is slow; a large delta is a compass branch flip — ignore
          // it unless it persists for a couple of seconds (a genuine
          // re-reference, e.g. the platform re-zeroing alpha).
          if (Math.abs(delta) < 0.7) {
            yawCorrectionRad = wrapRad(yawCorrectionRad + delta * 0.03);
            rejectedInARow = 0;
          } else {
            rejectedInARow += 1;
            if (rejectedInARow > 120) {
              yawCorrectionRad = target;
              rejectedInARow = 0;
            }
          }
        }
      }
      if (yawCorrectionRad !== null) {
        const calibrated = quatMultiply(quatFromAxisAngle(0, 1, 0, yawCorrectionRad), attitude);
        const calibratedGaze = rotateVector(calibrated, [0, 0, -1]);
        const headingDeg =
          ((Math.atan2(calibratedGaze[0], -calibratedGaze[2]) / DEG) % 360 + 360) % 360;
        const calibratedPitchDeg =
          Math.asin(Math.min(1, Math.max(-1, calibratedGaze[1]))) / DEG;
        if (debugElement) {
          debugElement.textContent =
            `α ${event.alpha?.toFixed(1)} β ${event.beta?.toFixed(1)} γ ${event.gamma?.toFixed(1)}\n` +
            `platform ${platformHeadingDeg?.toFixed(1) ?? "–"}° · type ${event.type}\n` +
            `heading ${headingDeg.toFixed(1)}° pitch ${calibratedPitchDeg.toFixed(1)}°\n` +
            `correction ${((yawCorrectionRad / DEG + 360) % 360).toFixed(1)}° rejects ${rejectedInARow}`;
        }
        onLook({
          headingDeg,
          pitchDeg: calibratedPitchDeg,
          quaternion: calibrated,
        });
        return;
      }
    }
    if (look !== null) onLook(look);
  };
  window.addEventListener("deviceorientationabsolute", listener as EventListener);
  window.addEventListener("deviceorientation", listener as EventListener);
  return () => {
    window.removeEventListener("deviceorientationabsolute", listener as EventListener);
    window.removeEventListener("deviceorientation", listener as EventListener);
  };
}
