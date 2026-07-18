# ADR-0020: A frame that only moves when you do

- Status: accepted
- Date: 2026-07-17

## Context

Round-13 on-device feedback. The through-line: the camera frame and the map
should respond to the traveler's input and nothing else — no spring-backs,
no feedback loops, no freezes — and the imagery should degrade gracefully
in space and time.

1. Rotating the inner system and letting go slid the view back to the
   guided frame. Root cause: round-11's map-leg free-look decay gated on
   `nadirBlendForAltitude > 0.5` — but that blend is monotonic in altitude
   and stays 1 forever, so the "map leg" decay ran at EVERY altitude and
   ate the orbit-drag offsets.
2. In tilt (compass) navigation, touching the screen froze the view: the
   compass drive was gated on `pointerId === null`.
3. The plane band drifted oddly around 150k–200k mi. Root cause: the
   Earth–Moon FOV widening fed on the instantaneous Moon separation angle;
   as the camera crossed the Moon's distance the separation (and with it
   the FOV, and with THAT the whole projected frame) crept and kinked.
4. The pull-out showed the horizon while the satellite view arrived, the
   ~1,500 mi bank onset was "a little too jarring", the imagery pyramid
   went blank between the widest patch (~440 km) and the Blue Marble
   takeover, the imagery stayed daylit at night, and the blue dot washed
   out against bright streets. Plus paper cuts: sky circles 1px off-center
   (border-box inside a 20px anchor), inset values riding low (flex
   stretch, not baseline), small ×s, small slider thumb.

## Decision

1. **Free-look decay belongs to the map leg alone**: gated on
   `nadirBlend > 0.5 && revealBlend < 0.5`. Beyond the bank, offsets are
   the orbit drag and persist until the traveler changes them.
2. **Tilt navigation ignores the pointer** (drag-look was already
   suppressed; taps still select markers) **and belongs to the ground**:
   the compass drive fades out over 15–60 m with the map takeover instead
   of 100–200 km. Off the ground, the phone's attitude no longer matters.
3. **The Earth–Moon widening is altitude-only**:
   `earthMoonCompositionForAltitude(altitudeM)` lerps the FOV toward the
   system framing's 78° on the same log band (7.4→8.7) — no per-frame moon
   feedback, no min/max kinks. The frame moves only when the traveler
   moves, monotonically.
4. **Choreography retimed**: nadir drop completes by ~30 m (100 ft, log
   1.0→1.48) BEFORE the imagery fades in (now 25–60 m); the reveal bank
   widened to log 6.1→7.3 (finishing exactly at whole Earth) with
   smootherstep — zero velocity and acceleration at both ends.
5. **Imagery pyramid**: fifth patch at z6 (~1,900 km wide) with z9 ceded a
   1.2e6 m ceiling — no blank ring anywhere on the pull-out. The patches
   dim to a cool moonlit blue by sun altitude (`daylight` threaded into
   `SatellitePatches.update`), so the map matches the hour.
6. **Observer dot**: deep blue core (0x1d5bd8) in a white ring — legible
   on bright imagery.
7. **Paper cuts**: sky circles inset 1px (border-box), inset rows align
   on baseline, ×s at 46px, slider thumb hit area 33px via transparent
   border (visible dot unchanged at 21px).

## Verified, not changed

- The startup band angle ("looks like I'm far north sometimes") is the
  sky: at Indianapolis the ecliptic's peak altitude swings 34° (July
  evening) to 73° (July midday) every day. Computed against
  astronomy-engine for four times of day; the render pipeline was already
  pinned by tests. The Sun always sits ON the band.

## Consequences

- 104 unit tests, 44 e2e green; verified live at 991 ft (night-dimmed
  nadir map), 98.9 mi and 495 mi (full-frame imagery, no blank ring,
  visible dot), plus the standard landmark sweep.
- First-run tile downloads grow to ~80 tiles (~2.5 MB), cached after.
