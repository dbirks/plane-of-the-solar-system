# 0018 — satellite imagery and the map beat

- Status: accepted
- Date: 2026-07-15

## Context

Tenth round of live narration, with a deliberate policy change from the
user: close-up satellite imagery is wanted, and the privacy copy should say
plainly that viewing it downloads tiles for your area from a map provider
(location otherwise stays in the browser). The pull-out still read as
"tilts and spins at the horizon, then suddenly the ball"; the request was a
familiar aerial frame almost immediately, zooming out dead-centered on the
observer's dot. Plus: the band's solid lines should hand into their dotted
continuation exactly at the horizon; drag should pause under tilt
navigation; a third header button for coarse locate; rail ticks drifted off
the rail; lines looked pixelated (~6.5M miles); a stall-and-retilt between
whole Earth and Earth–Moon; inset blurbs and small ×; Pluto's face showed
the unimaged black south.

## Decision

1. **Provider.** MapLibre is a client library, not a tile source; what the
   app needs is a raster endpoint. Chosen: **Esri World Imagery**
   (street-level detail to z19, stable unkeyed tile endpoint, attribution
   "Esri, Maxar, Earthstar Geographics" shown on-screen whenever imagery is
   visible and in the credits). Alternatives evaluated: EOX Sentinel-2
   cloudless (no key, CC BY-NC-SA, ~z14 — no street level), NASA GIBS
   (public domain, ~z9), MapTiler/Mapbox (API keys, quotas). Esri wins on
   detail; the provider is isolated in `satellite-patch.ts` for swapping.
2. **Patches.** Four nested web-mercator patches (z18/15/12/9), each a
   4×4-tile canvas texture on a ground-aligned quad centered near the
   observer, fading in at 15–55 m and out to the Blue Marble at 300–1200 km,
   sharper levels above coarser. Tiles persist in the **Cache API**
   (`satellite-tiles-v1`) — precached at startup, never re-downloaded.
   Tangent-plane flatness is accepted at patch scales (v1).
3. **The map beat.** `nadirBlendForAltitude` (15–60 m) drops the gaze
   straight down, screen-up north — the aerial frame everyone knows — and
   the whole map leg to ~200 km stays dead-centered on the dot (pinching in
   from the ball descends back into your neighborhood). The reveal swing
   was starting at 300 m, which walked the camera ~1800 km around the
   planet while 13 km up (found when the imagery made it visible);
   `revealBlendForAltitude` now runs 200 → 2000 km, where the swing is
   geometrically sane.
4. **Privacy copy** (user decision): the chip reads "Your location stays in
   this browser, only to orient the sky and fetch close-up imagery of your
   area from the map provider." Device location requests are coarse:
   `enableHighAccuracy: false` and coordinates rounded to ~1 km.
5. **Coarse locate button** (open-crosshair icon) beside tilt and settings:
   asks, navigates, and falls back to the center of the US when declined.
6. Band dashes include horizon-crossing segments (either endpoint below)
   with a 2-of-3 pattern and an opacity floor — the solid lines visibly
   continue as dots under the label. Drag pauses while tilt navigation is
   active (pinch still travels); the compass button wears a phone-tilt
   glyph. Rail notches recentred on the narrowed input. DPR caps raised
   (mobile 2.25, default 2, high 2.5) — under-resolution upscaling was the
   "pixelated lines"; the adaptive governor still protects slow devices.
   Earth–Moon FOV widening capped at the system framing's 78° over a longer
   band, so apparent scale recedes monotonically — no stall, no dolly-zoom
   retilt. Inset blurbs removed, × enlarged, and Pluto's disc samples only
   the imaged band around the heart.

7. **Default depth mode flips to standard.** Under `reversedDepthBuffer` on
   the WebGL backend the imagery quads never rasterize (isolated by A/B on
   the same build; standard renders them perfectly; not culling, not depth
   test — a three.js backend issue to be reported upstream). Standard depth
   is the path every e2e scenario and live acceptance has always run, and
   the per-frame near/far scaling (ADR-0015's far-plane stretch) keeps
   depth precision across the journey. `?depth=reversed` and `?depth=log`
   remain reachable for comparison.

## Consequences

- The journey: free look → map view by 60 m over street-sharp imagery →
  long centered zoom-out to 200 km → one bank into the tilted ball →
  pure zoom to 80 AU.
- First run downloads ~64 tiles (~2 MB) for the observer's area; revisits
  hit the cache. Offline still works fully except fresh imagery.
- 102 unit tests (tile math pinned against known slippy tiles).
- The SPEC privacy stance is AMENDED by user decision (this ADR supersedes
  the ADR-0017 deferral).
