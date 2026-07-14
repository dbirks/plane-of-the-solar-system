export const INTRO_STORAGE_KEY = "pss-intro-dismissed";

/**
 * A brief welcome before the sky. Shows on a visitor's first plain visit
 * (reproducible ?time/?lat URLs skip it). Movement help and the phone
 * pointing toggle live in the settings dialog.
 */
export function IntroDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Storage can be unavailable (private mode) — the dialog just reopens.
    }
    onClose();
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
        <button type="button" className="intro-begin" onClick={dismiss}>
          Continue
        </button>
      </aside>
    </div>
  );
}
