# 0006 — offline observer-location chain

- Status: accepted
- Date: 2026-07-12

## Context

SPEC §23 sketches a location provider chain that includes an "edge/IP"
provider — a runtime HTTP call to a third-party IP-geolocation service. The
performance budget bans runtime third-party assets, the spec bans permission
prompts on the opening path, and the maintainer chose privacy over automatic
precision when asked directly.

## Decision

Ship a fully offline chain in `src/location/observer-location.ts`:

1. explicit `?lat=`/`?lon=` URL parameters (reproducible, always win);
2. a saved default in `localStorage` (`plane-observer-location-v1`);
3. an IANA-timezone centroid table (~60 metropolitan zones);
4. the Indianapolis fallback.

Precise browser geolocation exists only as a user-initiated button in the
observer chip's location panel, which also offers manual coordinates, saving a
default, and clearing it. Applying a location rewrites the URL query and
reloads, so location stays reproducible URL state. No IP-geolocation call is
made anywhere.

## Consequences

- The opening sky is approximately right for most visitors (timezone centroid)
  and exactly right after one tap or a shared URL; nothing about the visitor
  leaves the browser.
- Users in uncommon timezones fall back to Indianapolis until they set a
  location; the chip labels the source honestly ("Near Tokyo", "Saved
  location") so the approximation is visible.
- Deferred: reverse-geocoded place names for manual coordinates (label shows
  the raw numbers), and an IP provider if automatic accuracy ever matters more
  than the no-third-party rule.

## Verification

- `src/tests/observer-location.test.ts` covers chain order, malformed URL and
  storage input, save/load/clear round-trip, and timezone label formatting.
- Live Playwright CLI check: headless Chromium resolves "Near New York" via
  its timezone, the panel opens with pre-filled coordinates, and the opening
  target recomputes for the resolved location.
