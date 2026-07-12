# Assets

Phase 0–1 uses no external textures, catalogs, icons, fonts, or imagery. Earth, atmosphere, guide marks, and stars in the decorative UI are generated from code/CSS.

The coarse continent coastlines are an original, deliberately simplified code-native outline in `src/scene/earth/continent-outlines.ts`. They use no external dataset or asset and are intended only as a geographic orientation cue, not cartographic geometry.

Every later external asset must be recorded here with its exact version, source URL, author/agency, license or media-use terms, processing steps, and output path before it is committed.

## Bright-star catalog (Phase 2)

- **Asset:** HYG stellar database, version 4.1 (`hygdata_v41.csv`)
- **Source:** <https://github.com/astronexus/HYG-Database> (file `hyg/CURRENT/hygdata_v41.csv`)
- **Author:** David Nash / Astronexus, compiled from Hipparcos, Yale Bright Star, and Gliese catalogs
- **License:** CC BY-SA 4.0
- **Processing:** `scripts/generate-star-catalog.mjs` filters to visual magnitude ≤ 5.5 (2,865 stars), keeps J2000 RA/dec (degrees), magnitude, B−V color index, and proper names for stars brighter than magnitude 2.1, sorted brightest first. Generated at development time and committed; no runtime or build-time network access.
- **Output path:** `src/scene/sky/star-catalog.ts`
