# Performance budgets

- Preferred frame rate: 60 fps; acceptable transition minimum: 30 fps.
- Mobile DPR cap: 1.5. Desktop DPR cap: 2.
- Avoid main-thread tasks over 50 ms after startup.
- Phase 1–2 target draw calls: under 12.
- No shadow maps and no runtime third-party assets.

Phase 2 additions and their measured cost (headless Chromium, WebGL 2 backend):

- Sky layer adds five draw calls at night (star points, planet points, Sun disc, Sun glow sprite, Moon sphere); daytime hides the point clouds. 60 fps held at ground and whole-Earth scales.
- The ~1 Hz astronomy snapshot (7 bodies through astronomy-engine plus one rotation matrix) costs about 1–2 ms on the frame it runs; acceptable against the 50 ms task budget, and a worker remains an option if later phases grow the per-tick work.
- The embedded star catalog adds ~77 KB source (~25 KB gzipped) to the bundle, inside the 8 MB transfer budget.
- Marker overlay updates are direct DOM transforms (7 elements per frame, no React work).

Measured results are recorded in `PRECISION_REPORT.md` after browser validation.
