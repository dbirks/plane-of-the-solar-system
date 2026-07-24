# ADR-0022: Anchors you can point to

- Status: accepted
- Date: 2026-07-23

## Context

Round-15 on-device feedback, mid-rethink: the user is circling how to make
the journey _prove_ "you live on the side of a ball in space, on a plane
that leads to the Sun." Concrete reports this round:

1. Startup band "too low — looks like I'm way up north"; asked for a race-
   condition audit of the latitude/longitude flow (third round of this).
2. Zooming out at night "does some daytime", and there are "two different
   nighttime views — the lights kind of move on us."
3. With tilt on, off the ground: the view should belong to the finger, and
   the tilt button should be plainly OFF (gray, not toggleable) — not the
   round-14 dormant-but-clickable state.
4. The blue dot needs to be bigger with a much more noticeable halo at
   mid-pull-out (~5 mi).
5. The Moon has an off-screen pointer at whole Earth; the Sun doesn't.
6. Asked whether the Moon renders at its true sky size.

## Decision

1. **Audit result: no race, and the app now says so.** Every lat/lon
   consumer takes (latitude, longitude) in order; the silent-adoption path
   mutates renderer flags before the next 1 Hz astronomy tick; worst case is
   one second of the timezone-centroid sky. The band's height is real
   diurnal astronomy (July evening at Indy: peak 29–38°; midday 74°). NEW:
   the renderer publishes `eclipticPeakAltitudeDeg` (72-sample sweep of the
   ecliptic each astronomy tick) and the location panel states it in plain
   words — "arcs up to N° above the horizon right now… low on summer
   evenings, high at midday — the Sun always sits on it." A doubt that
   recurs three times is a UI gap, not a user error.
2. **One night at a time.** The globe's textures were released at 800 km
   while the imagery patches ran to 1,200 km — in the overlap both the VIIRS
   patch lights AND the globe's own Black Marble lights showed, misregistered
   ("the lights move"). The stylized-tone hold now runs to exactly the
   imagery fade-out (1.2e6 m) and releases by 4e6 m: patches own the ground
   up to the handoff, then the textured globe fades in alone.
3. **Tilt is a ground instrument, fully.** Off the ground (>60 m) the button
   is `disabled`, gray and dashed; the remembered choice re-engages on
   landing. The drag-suppression that tilt imposes now applies ONLY at
   ground altitudes — with tilt on, space drags work again (this was the
   real bug behind "turn back on the finger movement out in space").
4. **The dot is findable at a glance**: angular size 0.009 rad (was 0.006),
   rim shell 1.6×, plus a new soft blue halo shell at 2.6× and 38% opacity.
5. **The Sun's pointer never retires.** Like the Moon, the Sun is a physical
   anchor at every scale: past the sky-proxy fade a per-frame override
   carries it at the true geocentric direction (the system-scale override
   takes over beyond), and the overlay keeps its opacity at 1.
6. **Moon size verified correct** (not changed): the mesh renders at exactly
   `asin(R/d)` angular radius by construction (`computeMoonPlacement`),
   pinned by unit test. Today it is near apogee: 404,152 km → 0.493°
   diameter, slightly smaller than the 0.52° average — correctly so.

## Consequences

- The "side of a ball" question is deliberately NOT redesigned here — the
  user is still thinking; this round shipped the anchors (sun pointer, dot
  halo, honest night) that any framing will need. Design options and
  questions went back in the round summary.
- 104 unit tests, 44 e2e green; verified live at dusk sim time
  (?time=2026-07-23T01:30Z): 319 mi lights carpet with sun pointer, 957 mi
  flat-tone hold (no double lights), whole-Earth night side with both Sun
  and Moon pointers and the banked band behind the globe.
