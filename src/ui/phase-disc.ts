/**
 * Shared phase-disc rendering for the Moon and planet insets: the body's
 * surface map (or a flat tint) drawn as a disc, with the night side dimmed
 * through a single terminator path. Safari-safe — CanvasRenderingContext2D
 * .filter is NOT supported there (which once made a new Moon render full),
 * so dimming is a translucent fill over the night region instead.
 */

/**
 * Trace one hemisphere region (lit or night) as a single path: half the limb
 * on `onRight`'s side plus the terminator half-ellipse whose minor axis
 * follows the illuminated fraction.
 */
function traceHemisphere(
  context: CanvasRenderingContext2D,
  center: number,
  radius: number,
  fraction: number,
  onRight: boolean,
): void {
  const minorAxis = Math.max(0.4, radius * Math.abs(2 * fraction - 1));
  // A minority region's terminator bulges toward its own limb, a majority
  // region's away from it.
  const counterclockwise = fraction < 0.5;
  context.beginPath();
  if (onRight) {
    context.arc(center, center, radius, -Math.PI / 2, Math.PI / 2, false);
    context.ellipse(center, center, minorAxis, radius, 0, Math.PI / 2, -Math.PI / 2, counterclockwise);
  } else {
    context.arc(center, center, radius, Math.PI / 2, -Math.PI / 2, false);
    context.ellipse(center, center, minorAxis, radius, 0, -Math.PI / 2, Math.PI / 2, counterclockwise);
  }
  context.closePath();
}

export type PhaseDiscOptions = {
  /** Equirectangular surface map; its central square becomes the face. */
  image: HTMLImageElement | null;
  /** Fallback face color while the image loads (or when none exists). */
  tint: string;
  /** CSS pixel size of the disc canvas. */
  sizePx: number;
  /** Sunlit share of the disc, 0–1. */
  illuminatedFraction: number;
  /** Which limb the Sun lights. */
  litOnRight: boolean;
};

/** Draw the disc at device pixel ratio. Call again when the image loads. */
export function drawPhaseDisc(canvas: HTMLCanvasElement, options: PhaseDiscOptions): void {
  const context = canvas.getContext("2d");
  if (!context) return;
  const pixelRatio = Math.min(3, window.devicePixelRatio || 1);
  const size = options.sizePx;
  if (canvas.width !== size * pixelRatio) {
    canvas.width = size * pixelRatio;
    canvas.height = size * pixelRatio;
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const center = size / 2;
  const radius = size / 2 - 2;
  const fraction = Math.min(1, Math.max(0, options.illuminatedFraction));

  context.clearRect(0, 0, size, size);

  // The full face first.
  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  const image = options.image;
  if (image && image.complete && image.naturalWidth > 0) {
    // Central square of the equirectangular map ≈ the facing hemisphere.
    const sourceSize = image.naturalHeight;
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    context.drawImage(
      image,
      sourceX,
      0,
      sourceSize,
      sourceSize,
      center - radius,
      center - radius,
      radius * 2,
      radius * 2,
    );
  } else {
    context.fillStyle = options.tint;
    context.fillRect(center - radius, center - radius, radius * 2, radius * 2);
  }
  context.restore();

  // Dim the night region (its fraction mirrors the lit one, opposite limb).
  if (fraction < 0.995) {
    context.save();
    traceHemisphere(context, center, radius, 1 - fraction, !options.litOnRight);
    context.clip();
    context.fillStyle = "rgba(5, 10, 16, 0.87)";
    context.fillRect(0, 0, size, size);
    context.restore();
  }
}
