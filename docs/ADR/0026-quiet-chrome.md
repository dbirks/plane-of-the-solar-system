# ADR-0026: Quiet chrome

- Status: accepted
- Date: 2026-07-24

## Context

Round-19 narration was all subtraction: the UI had accumulated words and
ornaments that the scene itself already communicates. "Altitude" and
"Distance from Earth" label a number whose meaning is obvious; the
small-caps landmark repeat above the rail duplicated the serif title; the
welcome dialog's scene-setting paragraph slowed the first tap; the circular
side-glow read as an artifact; the "WebGL 2" pill is diagnostics, not
experience; and two desktop-only fit-and-finish items (an oversized rail
thumb for a mouse pointer, and the browser scrollbar butting against the
settings switches).

## Decision

1. **The value stands alone.** The rail's readout block is gone; the bare
   value ("820 ft", "12,629 mi", "100 AU") renders under the serif h1 in
   the header, sans-serif, tabular numerals, renderer-driven per frame by
   the same `#scale-readout-value` id. The full worded form stays in the
   slider's `aria-valuetext` and the nonvisual summary — screen readers
   keep the words; sighted users keep the number.
2. **One landmark title.** Only the serif h1 names where you are. The
   `.scale-readout` block and its media-query variants are deleted.
3. **Intro dialog**: the "This is tonight's actual sky…" paragraph is
   removed — welcome, two verbs, go.
4. **`.sky-glow`** keeps only the bottom vignette; the radial side-glow is
   gone.
5. **Backend pill removed** from the header; the renderer backend remains
   in `?debug=1` and the aria summary (which is what the e2e asserts).
6. **Desktop (`pointer: fine`)**: rail thumb 28 px (16 px visible, ~3/4 of
   the touch size — touch devices keep 33/21 via pointer coarseness, not
   viewport width), and `.settings-body` gains right padding +
   `scrollbar-gutter: stable` so the scrollbar stops crowding the toggles.
   The settings ×'s vertical misalignment fixed itself with ADR-0025's SVG
   swap (text glyphs sit below center by baseline design).

## Consequences

- 105 unit tests, 44 e2e green; screenshots on both viewports: mobile
  header (serif title + bare sans value, no pill, no side glow), bare-URL
  intro without the paragraph, desktop settings with gutter and centered ×.
- The aria strings keep the words "Altitude"/"Distance from Earth" — tests
  and screen-reader phrasing are deliberately unchanged.
