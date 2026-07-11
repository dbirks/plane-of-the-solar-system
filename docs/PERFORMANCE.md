# Performance budgets

- Preferred frame rate: 60 fps; acceptable transition minimum: 30 fps.
- Mobile DPR cap: 1.5. Desktop DPR cap: 2.
- Avoid main-thread tasks over 50 ms after startup.
- Phase 1 target draw calls: under 12.
- No shadow maps and no runtime third-party assets.

Measured results are recorded in `PRECISION_REPORT.md` after browser validation.
