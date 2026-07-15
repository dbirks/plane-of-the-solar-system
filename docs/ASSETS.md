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

## Place catalog (post-spec polish)

- **Asset:** GeoNames `cities15000` dump, filtered to population ≥ 100,000 with city sections (PPLX) and abandoned places excluded — 5,807 places
- **Source:** <https://download.geonames.org/export/dump/> (cities15000.zip)
- **Author:** GeoNames (<https://www.geonames.org/>)
- **License:** CC BY 4.0
- **Processing:** `scripts/generate-place-catalog.mjs` → committed `src/location/place-catalog.ts` (name, coordinates, country/US-state); no network at build or runtime
- **Use:** the observer chip shows "Near <city>" instead of raw coordinates — a coarse, privacy-friendly offline anchor (nothing ever leaves the device)

## Moon imagery (round 4)

- **Asset:** NASA CGI Moon Kit color map (LRO LROC WAC + poles), `lroc_color_poles_4k.tif`
- **Source:** <https://svs.gsfc.nasa.gov/4720> (NASA Scientific Visualization Studio)
- **Author:** NASA's Scientific Visualization Studio (Ernie Wright), from Lunar Reconnaissance Orbiter data
- **License:** NASA imagery — free for public use with attribution
- **Processing:** resized to 2048×1024, JPEG quality 82 via ImageMagick
- **Output path:** `public/textures/moon-lroc-2048.jpg` (330 KB)
- **Use:** albedo on the physically-lit Moon mesh (terminator stays true geometry); flat shading remains the fallback. Tidally-locked orientation, libration ignored (ADR-0009).

## Planet imagery (round 8)

- **Assets:** equirectangular surface maps for Mercury, Venus (atmosphere), Mars, Jupiter, Saturn, Uranus, Neptune
- **Source:** <https://www.solarsystemscope.com/textures/> (2k downloads)
- **License:** CC BY 4.0 (Solar System Scope / INOVE), attributed in the Settings credits
- **Processing:** resized to 1024×512, JPEG quality 78 via ImageMagick (364 KB total)
- **Output paths:** `public/textures/planet-<name>-1024.jpg`
- **Use:** the selection inset draws each planet's facing hemisphere as a disc with the physically correct phase (illuminated fraction from astronomy-engine; the lit limb faces the Sun's side of the sky). Pluto has no freely licensed map here and falls back to a tinted disc. The main scene still renders true sizes only — this close-up is labeled UI.

## Pluto imagery (round 9)

- **Asset:** New Horizons global color mosaic of Pluto (LORRI + MVIC), the heart (Sputnik Planitia) centered
- **Source:** <https://www.jpl.nasa.gov/images/pia11707-pluto-color-map/> (PIA11707)
- **Credit:** NASA / Johns Hopkins APL / Southwest Research Institute — public domain
- **Processing:** resized to 1024×512, JPEG quality 78 via ImageMagick (60 KB)
- **Output path:** `public/textures/planet-pluto-1024.jpg`
- **Use:** the Pluto selection inset. The unimaged southern hemisphere (dark during the 2015 flyby) remains black — honest data, not a rendering bug.
