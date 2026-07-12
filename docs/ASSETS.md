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

## Earth imagery (Phase 5)

- **Asset:** NASA Blue Marble Next Generation (August 2004, topography & bathymetry), `world.topo.bathy.200408.3x5400x2700.jpg`
- **Source:** <https://visibleearth.nasa.gov/> (NASA Earth Observatory; image record 73776)
- **Author:** NASA Earth Observatory (Reto Stöckli et al.)
- **License:** NASA imagery — free for public use with attribution ("NASA Earth Observatory")
- **Processing:** resized to 4096×2048, JPEG quality 82 via ImageMagick
- **Output path:** `public/textures/earth-day-4096.jpg` (932 KB)

- **Asset:** NASA Black Marble 2016 night lights, `BlackMarble_2016_01deg.jpg`
- **Source:** <https://earthobservatory.nasa.gov/features/NightLights> (image record 144898)
- **Author:** NASA Earth Observatory (Joshua Stevens, using Suomi NPP VIIRS data from Miguel Román)
- **License:** NASA imagery — free for public use with attribution
- **Processing:** resized to 2048×1024, JPEG quality 80 via ImageMagick
- **Output path:** `public/textures/earth-night-2048.jpg` (176 KB)

Both textures load asynchronously after the opening scene; the code-native flat-shaded globe remains the permanent fallback if loading fails. In-app credits appear in the Layers panel.
