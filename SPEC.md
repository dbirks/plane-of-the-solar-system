# Earth-to-Solar-System Orientation App

## Coding Agent Implementation Guide

**Status:** Initial implementation specification
**Primary platform:** Mobile and desktop web
**Primary interaction:** Drag to look; logarithmic slider to move between ground and solar-system scales
**Initial simulation state:** Current date, time, and approximate user location
**Rendering principle:** Physically truthful positions, distances, sizes, and directions; use UI markers rather than enlarging celestial bodies

---

# 1. Product purpose

Build an immersive web experience that helps a person feel that they are standing on the side of a spherical planet within the solar system.

The central insight is not merely “this is why the Moon has phases.” The intended emotional and spatial realization is:

> The ground beneath me is a tangent to a planet. My local “up” is not solar-system “up.” The Sun, Moon, and planets occupy real directions around me, and I am standing at one particular orientation on Earth.

The user should begin at an approximately correct location on Earth, looking into an accurate current sky. They can look around, locate the Moon, Sun, visible planets, and bright stars, and then move a single scale control outward.

As they move outward:

1. The atmospheric horizon gradually curves.
2. The horizon becomes the physical limb of Earth.
3. Their starting position remains marked.
4. Earth becomes visibly spherical beneath them.
5. The Moon appears at its true distance, direction, and size.
6. The ecliptic and planetary orbits can be revealed as optional guides.
7. The journey can continue through the inner solar system and out to Pluto.

The experience must feel continuous, but the implementation may use different precision-safe render representations beneath the surface.

---

# 2. Product principles

## 2.1 Spatial truth over spectacle

Do not enlarge the Moon, planets, or Sun in the primary scene.

At scales where an object would be smaller than one screen pixel:

* Keep the physical body at its true size.
* Add a separate screen-space marker.
* Add an optional label.
* Allow selection through the marker.
* Show a magnified inspection inset when selected.

The marker is UI. It must not masquerade as the object itself.

## 2.2 One logical universe, multiple render representations

Earth, the Moon, and every celestial body are each one logical entity.

The renderer may represent an entity differently at different scales:

* A direction-based sky proxy near the surface
* A local spherical surface representation
* A global sphere
* A true-position body in an Earth-centered frame
* A true-position body in a heliocentric frame

Transitions between representations must be aligned and visually seamless.

Do not force a single fragile GPU mesh or coordinate frame to cover everything from eye level to Pluto.

## 2.3 Continuous user control

The outward journey is not a prerecorded movie and does not require a play button.

The user directly controls the target scale using:

* A visible slider
* Mouse wheel
* Trackpad scroll
* Touch interaction
* Optional pinch gesture

The camera follows the user’s target through damped, acceleration-limited motion.

Fast input should produce fast travel, but never teleportation or a visually violent camera jump.

## 2.4 Guided, not locked

The user can drag to rotate at any scale, including during the transition.

When the user resumes moving the scale slider, the camera should calculate a new smooth route from its current pose toward the preferred educational composition for the new scale.

Do not snap back to a predetermined rail.

## 2.5 Optional explanation

The default experience should remain visually minimal.

Scientific overlays should be available through a Layers control:

* Ecliptic plane or band
* Planetary orbit lines
* Lunar orbit
* Earth’s axis
* Equator
* Local tangent grid
* Object labels
* Below-horizon orientation markers

The geometry should carry most of the explanation.

---

# 3. First-version experience

## 3.1 Opening

On load:

1. Determine the current UTC time.
2. Resolve an approximate user location without immediately showing a browser permission dialog.
3. Build the astronomical snapshot.
4. Select an interesting initial viewing target.
5. Display the sky immediately.
6. Offer precise browser location and compass mode as optional actions.

Initial target priority:

1. Moon above the horizon
2. Moon visible during daylight
3. Sun, particularly near sunrise or sunset
4. Bright visible planet
5. Bright visible star
6. Neutral south-facing orientation

When the app chooses something other than the Moon, it may show a small temporary caption for approximately five seconds:

> Moon below horizon · Centering on Venus

Do not show a lengthy explanation for the target choice.

## 3.2 Ground view

The ground view contains:

* An atmospheric sky
* A clean horizon without generated terrain
* The real current Sun direction
* The real current Moon direction and phase
* Visible planets
* A subtle, accurate bright-star field
* Optional ghost markers for objects below the horizon
* A compact compass ribbon
* A visible scale slider
* A distance or altitude readout

The ground should not look like a Google Earth screenshot.

Do not add buildings, mountains, roads, country labels, or generated biome scenery in the first version.

## 3.3 Looking around

Desktop:

* Drag the sky to look around.
* Mouse wheel controls outward/inward scale.
* The visible slider remains synchronized.

Mobile:

* Drag the sky to look around.
* Drag the scale control to move outward or inward.
* Optional compass mode maps physical device orientation to camera orientation.
* Compass mode must be explicitly enabled by a user gesture.
* Dragging while compass mode is active may temporarily add a heading offset.
* Include a Recenter control.

Device orientation requires HTTPS and can require explicit permission depending on browser support, so drag navigation must always remain available.

## 3.4 Below-horizon objects

The physical object remains occluded by Earth.

A separate orientation marker may be rendered through the ground:

* Dashed or outlined
* Low opacity
* Clearly nonphysical
* Labeled with altitude below the horizon

Example:

> Moon · 14° below horizon

The marker should appear at the object’s mathematically correct direction, not clamped to the horizon.

## 3.5 Outward journey

The scale control should pass through soft landmarks:

1. Ground
2. Atmospheric ascent
3. Low orbit
4. Whole Earth
5. Earth–Moon system
6. Inner solar system
7. Full solar system

The notches should gently attract the target scale but remain easy to pass through.

At the full solar-system view, include:

* Mercury
* Venus
* Earth
* Mars
* Jupiter
* Saturn
* Uranus
* Neptune
* Pluto

Major bodies remain true-size and true-position. Their markers remain usable even when their meshes are sub-pixel.

---

# 4. Explicit non-goals

Do not build the following in the initial implementation:

* Full planetarium functionality
* Telescope controls
* Complete deep-sky catalogs
* Live terrain streaming
* Google Earth integration
* Street-level imagery
* Weather or real-time cloud data
* N-body orbital simulation
* Spacecraft navigation
* Multiplayer
* Native mobile apps
* Rust or WebAssembly rendering
* React Three Fiber
* CesiumJS
* Stellarium Web Engine
* A generalized astronomy engine
* Arbitrary planetary landing
* Time scrubbing

The architecture should permit later time controls and additional coordinate frames, but do not implement them prematurely.

---

# 5. Chosen stack

## 5.1 Application

Use:

* Vite
* React
* TypeScript with strict mode
* Tailwind CSS
* Zustand for application state
* Vitest for unit tests
* Playwright for browser and visual tests
* pnpm for package management

React owns:

* Controls
* Panels
* Labels
* Location workflow
* Compass workflow
* Settings
* Accessibility
* Loading states
* Inspection inset containers
* Debug tools

React should not own the per-frame render loop.

## 5.2 Renderer

Use direct Three.js rather than React Three Fiber.

Start with Three’s `WebGPURenderer`. It currently prefers WebGPU when supported and falls back to a WebGL 2 backend when WebGPU is unavailable. It also supports a `forceWebGL` option, which should be exposed through a development query parameter.

Use:

```text
?renderer=auto
?renderer=webgl
```

Do not rely on raw `ShaderMaterial` or `RawShaderMaterial` for materials expected to work through the WebGPU renderer.

Implement custom materials using:

* Standard node materials
* Three.js Shading Language, or TSL
* `NodeMaterial.fragmentNode`
* `NodeMaterial.vertexNode`
* TSL uniform nodes

Three’s node-material system provides programmable vertex and fragment nodes and is intended for renderer-agnostic shader construction.

Pin the Three.js version in the lockfile. Do not automatically upgrade Three during unrelated work.

## 5.3 Astronomy

Use the JavaScript/TypeScript Astronomy Engine package.

It provides:

* Geocentric vectors
* Heliocentric vectors
* Topocentric observer positions
* Horizontal altitude and azimuth
* Moon phase and illuminated fraction
* Apparent magnitude
* Earth rotation information
* Ecliptic, equatorial, horizontal, and galactic transforms
* Planetary rotation axes
* Pluto support

Astronomy Engine documents approximately arcminute-level accuracy and includes the Sun, Moon, major planets, and Pluto.

Install:

```bash
pnpm add three astronomy-engine zustand
```

## 5.4 Assets

Use legally redistributable static textures.

Preferred initial sources:

* NASA Blue Marble or another NASA global Earth image
* NASA planetary texture resources
* NASA Moon texture or model resources
* HYG bright-star subset

NASA maintains downloadable planetary textures and 3D resources that are free to use subject to its media-use guidelines.

The former HYG GitHub repository is archived and directs users to the maintained Codeberg repository. Record the exact dataset version and license in `docs/ASSETS.md`.

Do not fetch large catalogs or textures at runtime from third-party repositories.

Process and commit optimized application assets.

---

# 6. Repository structure

Use this approximate structure:

```text
/
├─ public/
│  ├─ textures/
│  ├─ data/
│  └─ icons/
├─ scripts/
│  ├─ build-star-catalog.ts
│  ├─ build-orbit-lines.ts
│  └─ optimize-textures.ts
├─ src/
│  ├─ app/
│  │  ├─ App.tsx
│  │  ├─ app-store.ts
│  │  └─ feature-flags.ts
│  ├─ astronomy/
│  │  ├─ astronomy-service.ts
│  │  ├─ body-catalog.ts
│  │  ├─ opening-target.ts
│  │  ├─ phase.ts
│  │  └─ types.ts
│  ├─ coordinates/
│  │  ├─ frames.ts
│  │  ├─ transforms.ts
│  │  ├─ geodetic.ts
│  │  ├─ render-origin.ts
│  │  ├─ units.ts
│  │  └─ vec3d.ts
│  ├─ simulation/
│  │  ├─ simulation-clock.ts
│  │  ├─ scene-snapshot.ts
│  │  └─ snapshot-builder.ts
│  ├─ camera/
│  │  ├─ journey-controller.ts
│  │  ├─ camera-spring.ts
│  │  ├─ camera-compositions.ts
│  │  ├─ scale-domains.ts
│  │  └─ input-controller.ts
│  ├─ renderer/
│  │  ├─ space-renderer.ts
│  │  ├─ renderer-factory.ts
│  │  ├─ render-context.ts
│  │  ├─ projection-service.ts
│  │  └─ performance-monitor.ts
│  ├─ scene/
│  │  ├─ earth/
│  │  ├─ atmosphere/
│  │  ├─ moon/
│  │  ├─ stars/
│  │  ├─ planets/
│  │  ├─ orbits/
│  │  ├─ markers/
│  │  └─ guides/
│  ├─ location/
│  │  ├─ location-service.ts
│  │  ├─ saved-location.ts
│  │  ├─ approximate-location.ts
│  │  └─ device-geolocation.ts
│  ├─ orientation/
│  │  ├─ compass-service.ts
│  │  └─ device-orientation.ts
│  ├─ ui/
│  │  ├─ ScaleSlider.tsx
│  │  ├─ DistanceReadout.tsx
│  │  ├─ CompassRibbon.tsx
│  │  ├─ LayerPanel.tsx
│  │  ├─ ObjectMarkerLayer.tsx
│  │  ├─ InspectionInset.tsx
│  │  └─ OpeningCaption.tsx
│  ├─ workers/
│  │  └─ orbit-worker.ts
│  ├─ tests/
│  └─ main.tsx
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ COORDINATES.md
│  ├─ ASSETS.md
│  ├─ PERFORMANCE.md
│  └─ adr/
├─ SPEC.md
└─ README.md
```

---

# 7. Domain model

The physical model must not depend on Three.js classes.

Use plain TypeScript data and double-precision JavaScript numbers.

```ts
export type Vec3d = readonly [number, number, number];

export type ObserverLocation = {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationM: number;
  source: "saved" | "edge" | "timezone" | "browser" | "manual" | "fallback";
  accuracyM?: number;
};

export type BodyId =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export type BodySnapshot = {
  id: BodyId;
  radiusM: number;

  heliocentricEclipticM: Vec3d;
  geocentricEquatorialM?: Vec3d;

  apparentLocalDirection?: Vec3d;
  apparentAltitudeDeg?: number;
  apparentAzimuthDeg?: number;

  phaseAngleDeg?: number;
  illuminatedFraction?: number;
  apparentMagnitude?: number;

  northPoleEqj?: Vec3d;
  primeMeridianDeg?: number;
};

export type SceneSnapshot = {
  timestampUtcMs: number;
  observer: ObserverLocation;
  bodies: ReadonlyMap<BodyId, BodySnapshot>;

  observerEqjM: Vec3d;
  sunAltitudeDeg: number;
  openingTarget: OpeningTarget;
};
```

All distances in the domain model should use meters unless a field explicitly says otherwise.

Astronomy Engine returns many vectors in astronomical units. Convert them at the service boundary.

```ts
export const METERS_PER_AU = 149_597_870_700;
```

Never allow anonymous vectors whose frame or units are unclear.

Prefer names such as:

```text
moonGeoEqjM
earthHelioEclM
observerLocalEnuM
sunDirectionHor
```

Avoid names such as:

```text
moonPosition
worldVector
position2
```

---

# 8. Coordinate frames

Create an explicit `FrameId` type:

```ts
export type FrameId =
  | "EQJ"
  | "ECL_J2000"
  | "HOR"
  | "LOCAL_THREE"
  | "EARTH_FIXED"
  | "HELIOCENTRIC_RENDER"
  | "EARTH_CENTERED_RENDER";
```

Document every frame in `docs/COORDINATES.md`.

## 8.1 EQJ

J2000 mean-equator coordinates.

Astronomy Engine returns `GeoVector` and `HelioVector` in this orientation.

Use EQJ as the stable astronomical interchange frame.

## 8.2 Ecliptic J2000

Use the J2000 ecliptic plane for the solar-system overview.

Domain axes:

* +X: J2000 equinox direction
* +Y: prograde along the ecliptic
* +Z: ecliptic north

Map this to Three’s Y-up coordinates as:

```ts
function eclipticToThree([x, y, z]: Vec3d): Vec3d {
  return [x, z, -y];
}
```

This retains a right-handed system.

## 8.3 Horizontal frame

Astronomy Engine’s horizontal Cartesian convention is:

* +X north
* +Y west
* +Z up

Convert it into the local Three convention:

* +X east
* +Y up
* +Z south
* -Z north

```ts
function horizonToLocalThree([north, west, up]: Vec3d): Vec3d {
  return [-west, up, -north];
}
```

## 8.4 Earth-fixed frame

Use WGS84 geodetic latitude, longitude, and height for the observer.

Earth texture orientation must reflect the current rotation of Earth.

Astronomy Engine provides both observer vectors and Greenwich apparent sidereal time. Its `ObserverVector` accounts for Earth’s rotation at a specified time, while `SiderealTime` exposes the rotation of the Greenwich meridian relative to the stars.

Do not manually guess Earth rotation from local clock time.

## 8.5 Future galactic frame

Do not render galactic-scale content in version one.

Reserve the frame identifier and transformation boundary so a later implementation can transition into galactic coordinates without rewriting the physical model.

---

# 9. Apparent and physical positions

Maintain two related but distinct concepts.

## 9.1 Apparent observer view

Used for the ground sky:

* Topocentric parallax
* Light-travel correction
* Aberration where appropriate
* Optional atmospheric refraction
* Observer-specific altitude and azimuth

Use Astronomy Engine’s `Equator` followed by `Horizon` for Sun, Moon, and planets.

`Equator` computes topocentric coordinates and includes observer parallax, which is particularly important for the Moon. `Horizon` converts those coordinates into altitude and azimuth.

Recommended flow:

```ts
const eq = Astronomy.Equator(
  body,
  date,
  observer,
  true,  // equator of date
  true,  // aberration
);

const hor = Astronomy.Horizon(
  date,
  observer,
  eq.ra,
  eq.dec,
  "normal",
);
```

## 9.2 Geometric physical scene

Used for the solar-system model:

* Instantaneous heliocentric positions
* No atmospheric refraction
* No topocentric visual correction
* True distances

Use `HelioVector`, transform EQJ to ecliptic coordinates, then convert AU to meters.

`HelioVector` produces heliocentric EQJ vectors without light-travel or aberration correction.

The apparent and physical locations may differ slightly. That is valid.

The transition from apparent sky proxy to geometric object should occur gradually after the object becomes too small for the difference to be perceptually noticeable.

---

# 10. Simulation clock

Implement a `SimulationClock` even though time controls are not yet exposed.

```ts
type SimulationClockState = {
  utcMs: number;
  rate: number;
  paused: boolean;
};
```

Version-one defaults:

```text
rate = 1
paused = false
```

Update the astronomical snapshot approximately once per second.

Do not recalculate full orbit-line geometry every second.

The clock API must support later operations:

```ts
clock.setTime(...)
clock.setRate(...)
clock.pause()
clock.resume()
```

Do not build a time scrubber yet.

---

# 11. Astronomy snapshot builder

For every update:

1. Create an Astronomy Engine observer.
2. Compute the observer’s EQJ vector.
3. Compute heliocentric vectors for all supported bodies.
4. Transform the heliocentric vectors into the ecliptic frame.
5. Compute apparent topocentric positions for visible sky bodies.
6. Compute illumination information.
7. Compute body rotation axes when required.
8. Score the opening target.
9. Publish an immutable `SceneSnapshot`.

Astronomy Engine’s illumination result includes:

* Phase angle
* Illuminated fraction
* Geocentric distance
* Heliocentric distance
* Visual magnitude

Use those values rather than deriving named phases from calendar age alone.

## 11.1 Moon phase name

Create a pure function that maps ecliptic Moon phase angle to:

* New Moon
* Waxing Crescent
* First Quarter
* Waxing Gibbous
* Full Moon
* Waning Gibbous
* Third Quarter
* Waning Crescent

Keep the numeric phase angle and illuminated fraction available separately.

## 11.2 Opening target scoring

Implement the following baseline scoring.

Moon:

* Require altitude above 0°.
* Add a strong fixed priority bonus.
* Slightly prefer higher altitude.
* Prefer illuminated fraction above approximately 0.05.

Sun:

* Strong candidate when above the horizon.
* Add a bonus when altitude is between -6° and +12°.

Planets:

* Require altitude above approximately 5°.
* Use visual magnitude as the main score.
* Penalize objects too close to the Sun.
* Venus and Jupiter will often naturally score highly.

Stars:

* Require Sun altitude low enough for visibility.
* Rank by apparent magnitude and altitude.

The opening-target algorithm should be deterministic for a fixed timestamp and location.

---

# 12. Star catalog

Create a build script that processes a catalog into a small application-specific binary or JSON asset.

Initial selection:

* Stars through approximately magnitude 5.5
* Name, when available
* Right ascension
* Declination
* Apparent magnitude
* Color index or approximate spectral color
* Constellation identifier, when available

Do not ship hundreds of thousands of stars initially.

Target approximately:

```text
1,500–4,000 stars
```

Render the catalog as one GPU point cloud.

Star brightness should fade based on:

* Apparent magnitude
* Sun altitude
* Atmospheric brightness
* Device pixel ratio

Suggested sky visibility:

```text
Sun altitude > -4°:
  Hide nearly all stars.

-4° to -10°:
  Show only the brightest stars.

-10° to -16°:
  Gradually reveal more stars.

Below -16°:
  Show the configured catalog limit.
```

Constellation lines should be a separate optional layer.

---

# 13. Logical celestial objects and render representations

Each logical object can own several representations.

```ts
interface RenderRepresentation {
  minLogDistance: number;
  maxLogDistance: number;
  update(context: RenderContext, body: BodySnapshot): void;
  setOpacity(value: number): void;
}
```

## 13.1 Moon representations

Use:

1. Ground-sky Moon proxy
2. Physical geocentric Moon
3. Heliocentric Moon, where necessary
4. Inspection inset Moon

The ground proxy should preserve:

* Correct direction
* Correct apparent angular diameter
* Correct phase
* Correct illuminated-side orientation

Place the proxy at a convenient render distance and calculate its radius from the required angular diameter.

Do not place it at an arbitrary large angular size.

Crossfade from the proxy to the physical Moon during ascent while maintaining screen alignment.

## 13.2 Star representation

Stars remain direction-based points on a celestial sphere.

Their displayed distance is not intended to represent their actual distance.

This is acceptable because their role is directional orientation, not interstellar-scale mapping.

## 13.3 Sun representation

Near Earth:

* Use the apparent Sun direction for the sky disk.
* Use a directional-light representation for Earth and Moon lighting.

At solar-system scale:

* Render the Sun at its true position and radius.
* Retain a UI marker when sub-pixel.

## 13.4 Planet representations

At ground level:

* Render visible planets as magnitude-scaled points.
* Do not show resolved planetary disks except when physically resolvable.

At solar-system scale:

* Render true-radius spheres.
* Overlay screen-space selection markers.

---

# 14. Earth renderer

Earth is one logical object.

Start with one global sphere and camera-relative coordinates.

If the vertical-slice tests reveal near-surface jitter, introduce a local surface representation beneath the same logical object.

Possible Earth representations:

1. Local precision surface or spherical cap
2. Global Earth sphere
3. Very-distant Earth point/marker

The user must not see a pop between them.

## 14.1 Earth textures

Initial texture layers:

* Day color map
* Optional normal or bump map
* Cloud map
* Night-lights map
* Optional ocean specular mask

Do not use live imagery.

Suggested initial resolutions:

```text
Mobile:
  2048 × 1024 day map
  1024 × 512 clouds
  1024 × 512 night map

Desktop quality tier:
  4096 × 2048 day map
  2048 × 1024 clouds
```

Choose texture quality after the renderer measures device capability.

## 14.2 Earth lighting

Use the physical Sun direction.

Avoid shadow maps. The terminator can be produced directly by surface lighting.

Night lights should appear only where the surface is on the unlit side, with a soft terminator fade.

## 14.3 Earth rotation

Orient Earth’s texture using the simulation timestamp.

The observer marker must appear at the correct latitude and longitude on the rotating Earth.

Create an automated test that verifies the observer marker remains attached to the same geographic location while Earth rotates.

---

# 15. Atmosphere

The atmosphere is critical to the main experience.

It must work:

* From inside the atmosphere
* Near the horizon
* During ascent
* From low orbit
* From outside Earth

Implement in stages.

## Stage A: vertical-slice atmosphere

Use a TSL material that provides:

* Sky color based on Sun direction
* Horizon brightening
* Dusk and dawn color shift
* Atmosphere rim from space
* Fade to black with altitude

This does not need full scientific scattering initially.

## Stage B: quality atmosphere

Add a simplified single-scattering model with:

* Rayleigh component
* Mie component
* Sun angular radius
* Camera altitude
* Planet radius
* Atmosphere radius
* Adaptive sample count

Cap sampling on mobile.

The transition from atmospheric horizon to Earth limb must remain smooth.

Do not implement weather, clouds volumetrically, or multiple scattering in the first version.

---

# 16. Precision and render-origin strategy

This is the highest-risk engineering area.

## 16.1 Canonical truth

Keep physical positions as double-precision JavaScript numbers in meters.

Do not store canonical positions in Three `Vector3` objects.

## 16.2 Camera-relative rendering

The GPU should receive positions relative to a nearby render origin.

```ts
relativePosition =
  physicalPosition
  - renderOriginPhysicalPosition;
```

Then apply a scale factor appropriate to the active domain.

The render origin should normally follow the camera’s physical position.

For each body:

```ts
bodyRenderPosition =
  (bodyPhysicalPosition - renderOriginPhysicalPosition)
  * renderUnitsPerMeter;
```

## 16.3 Scale domains

Use several render domains.

### Local domain

Purpose:

* Ground
* Atmosphere
* Early ascent

Origin:

* Observer or nearby camera position

Units:

* Approximately one render unit per meter, subject to testing

### Earth-centered domain

Purpose:

* Whole Earth
* Earth–Moon system

Origin:

* Camera-relative, with Earth as the compositional target

Uniform scaling:

* Preserve true Earth–Moon distance and body sizes

### Heliocentric domain

Purpose:

* Inner and full solar system

Origin:

* Camera-relative within heliocentric ecliptic coordinates

Uniform scaling:

* Preserve planetary distances and body sizes

## 16.4 Depth buffer

Prefer `reversedDepthBuffer` when supported by the chosen Three renderer version.

Do not simultaneously enable logarithmic and reversed depth without verifying that the pinned version supports that combination.

Expose both modes as development experiments:

```text
?depth=reversed
?depth=log
?depth=standard
```

## 16.5 Precision fallback

If the Earth surface visibly jitters at two meters above the surface:

1. Measure the error.
2. Add a precision-safe local spherical cap or relative-to-eye high/low representation.
3. Crossfade to the global sphere as altitude increases.
4. Preserve identical texture coordinates and lighting.
5. Keep the logical Earth state shared.

Do not accept visible meter-scale surface vibration.

---

# 17. Journey scale

Represent the user’s outward position as logarithmic physical distance.

```ts
type JourneyState = {
  targetLogMeters: number;
  currentLogMeters: number;
  velocity: number;
};
```

For a normalized UI value:

```ts
function sliderToDistance(
  t: number,
  minM: number,
  maxM: number,
): number {
  return Math.exp(
    Math.log(minM) +
    t * (Math.log(maxM) - Math.log(minM)),
  );
}
```

Do not use a linear distance slider.

## 17.1 Suggested landmarks

Use approximate scale landmarks, not hard-coded camera positions:

```ts
const LANDMARKS = [
  { id: "ground", distanceM: 2 },
  { id: "atmosphere", distanceM: 100_000 },
  { id: "low-orbit", distanceM: 500_000 },
  { id: "whole-earth", distanceM: 20_000_000 },
  { id: "earth-moon", distanceM: 500_000_000 },
  { id: "inner-system", distanceM: 4e11 },
  { id: "full-system", distanceM: 8e12 },
];
```

Treat these as initial tuning values.

The final values should be selected by visual composition and true scene extents.

## 17.2 Soft attractors

Near a landmark:

* Apply a small bias toward it.
* Reduce velocity slightly.
* Never trap the user.
* Let continued drag override the attraction.

## 17.3 Distance readout

Use scale-aware formatting.

Near Earth:

```text
Altitude · 12.4 km
```

Farther out:

```text
Distance from Earth · 184,000 km
```

Solar scale:

```text
Distance from Earth · 1.42 AU
```

At very large future scales:

* Light-minutes
* Light-hours
* Light-years
* Parsecs

Do not display unnecessary decimal precision.

---

# 18. Camera system

Use quaternions throughout.

Do not store Euler angles as the authoritative camera state.

```ts
type PhysicalCameraState = {
  position: Vec3d;
  orientation: readonly [number, number, number, number];
  linearVelocity: Vec3d;
  angularVelocity: Vec3d;
  fovDeg: number;
};
```

## 18.1 Inputs

Drag:

* Updates a user orientation offset.
* Does not directly mutate the camera transform.

Slider:

* Updates target logarithmic distance.
* Signals that guided composition should resume gradually.

Compass:

* Supplies a device-derived base orientation.
* Retains a user-adjustable calibration offset.

## 18.2 Damped camera

Use a critically damped or near-critically damped spring.

Clamp:

* Linear speed
* Linear acceleration
* Angular speed
* Angular acceleration

Optionally clamp jerk if fast slider gestures remain uncomfortable.

The camera should not lag so heavily that the slider feels disconnected.

## 18.3 Guided composition

Create composition resolvers by scale domain.

```ts
interface CameraComposition {
  referenceFrame: FrameId;
  targetPosition: Vec3d;
  targetOrientation: QuaternionTuple;
  targetFovDeg: number;
  guideStrength: number;
}
```

Ground:

* Look toward the opening target.
* Preserve local up.

Ascent:

* Pull away in an arc.
* Begin revealing the observer’s radial orientation.
* Keep the observer marker in view.

Whole Earth:

* Compose Earth and observer marker.
* Make the local tangent relationship legible.

Earth–Moon:

* Compose Earth and Moon.
* Keep true scale.
* Allow the Moon marker to carry discoverability.

Solar system:

* Gradually approach an oblique view of the ecliptic.
* Do not force a perfectly top-down view.
* Keep the ecliptic plane visually understandable.

## 18.4 Recalculation after free rotation

When the user rotates during the journey:

1. Preserve the new orientation.
2. Record the free-look offset.
3. Stop increasing guided orientation strength while the slider is stationary.
4. When the slider moves again, create a new target composition from the current pose.
5. Blend toward it over scale progress rather than snapping over elapsed time.

The guidance should feel like a pilot assisting, not an animation taking control away.

---

# 19. Scale slider interaction

Use a visible vertical slider on mobile, positioned near the right edge.

Desktop may use the same control plus wheel input.

Requirements:

* Large touch target
* Keyboard accessible
* ARIA slider semantics
* Visible notches
* Current scale label
* Current distance readout
* No accidental page scrolling while interacting
* Respect reduced-motion settings

Suggested controls:

```text
Drag canvas: look around
Drag slider: move through scale
Mouse wheel: move through scale
Pinch: optional scale movement
Two-finger drag: no required behavior
```

Do not overload ordinary canvas drag with both rotation and zoom.

---

# 20. Markers and labels

Markers should be DOM or SVG overlays projected from 3D coordinates.

The renderer should publish projected screen coordinates through a `ProjectionService`.

```ts
type ProjectedMarker = {
  id: string;
  xPx: number;
  yPx: number;
  visible: boolean;
  occluded: boolean;
  behindCamera: boolean;
  angularDistanceFromViewDeg: number;
};
```

Marker rules:

* Minimum touch size approximately 40 CSS pixels
* Visual dot may remain smaller
* Use a leader line when needed
* Hide overlapping low-priority labels
* Never move the physical object to fit a label
* Use edge arrows for offscreen selected objects
* Use a ghost style for below-horizon objects

Priority:

1. Selected object
2. Moon
3. Sun
4. Opening target
5. Bright planets
6. Earth
7. Other planets
8. Pluto

At full-system scale, markers are expected to carry most object discoverability.

---

# 21. Moon inspection inset

When the Moon marker is selected:

1. Open a small inset panel.
2. Draw a leader line from the real Moon marker to the inset.
3. Render a close-up Moon sphere.
4. Use the current physical Sun-to-Moon lighting direction.
5. Use the Earth-to-Moon viewing direction.
6. Display the current phase name and illuminated fraction.
7. Keep the primary scene unchanged.

Suggested content:

```text
Moon
Waning Gibbous
78% illuminated
384,200 km from Earth
```

Use a second viewport rendered through the same main renderer when practical.

Avoid creating a separate GPU renderer unless necessary.

Exact lunar libration can be added using Astronomy Engine’s libration and axis-orientation capabilities. Version one may initially orient the near side toward Earth and add exact libration in a later quality pass.

---

# 22. Orbit lines and ecliptic guide

## 22.1 Planetary orbit lines

Orbit lines are explanatory guides.

Body positions must be current and accurate.

Orbit lines may be precomputed at build time from sampled ephemeris positions.

Use:

* Thin lines
* Low opacity
* Current planet marker
* Optional labels
* A selected-orbit highlight

Do not render orbital trails by default.

## 22.2 Moon orbit

The Moon’s orbit should be generated near the current date because its orientation and relationship to the ecliptic are part of the experience.

Sample approximately one lunar orbital period.

This can be computed in a worker and cached.

## 22.3 Ecliptic representation

Implement two related modes:

Ground view:

* A subtle band across the sky
* Low opacity
* Optional faint label
* Correct orientation for the observer

Space view:

* A translucent plane or thin grid through the heliocentric system
* Fade based on view angle
* Avoid a visually dominant solid disk

The band should transition conceptually into the plane as the camera moves outward.

Do not show the ecliptic by default until the first visual pass establishes whether it improves or distracts from the primary experience.

---

# 23. Location strategy

Create a provider chain.

Priority:

1. User’s saved location
2. Approximate edge or IP-derived location
3. Browser timezone centroid
4. Explicit product fallback
5. Optional browser geolocation after user action
6. Manual location entry

Do not block the initial scene on browser geolocation.

## 23.1 Approximate location API

Define:

```ts
interface ApproximateLocationProvider {
  resolve(): Promise<ObserverLocation | null>;
}
```

The concrete provider may later read deployment-platform geolocation headers.

Do not tightly couple the client to a specific hosting vendor.

## 23.2 Browser location

Expose:

> Use my location

When accepted:

* Read browser latitude and longitude.
* Do not require high accuracy.
* Smoothly relocate the observer.
* Rebuild the sky snapshot.
* Recompose the camera without a hard cut.
* Save the coarse result locally with user consent.

## 23.3 Manual entry

Version-one acceptable manual fields:

* City or postal code, if a geocoder is configured
* Latitude and longitude in an advanced section

Do not build a global location database into the initial bundle.

## 23.4 Privacy

Document:

* Why location is used
* That precise location is optional
* What is stored locally
* Whether any coordinates are sent to a server

Never retain the user’s IP address in application storage or logs for this feature.

---

# 24. Compass mode

Implement as progressive enhancement.

Flow:

1. User taps Enable Compass.
2. Request permission when required.
3. Subscribe to the best supported orientation event.
4. Convert device orientation into camera orientation.
5. Apply calibration offset.
6. Show Recenter.
7. Fall back gracefully to drag if unavailable or denied.

Requirements:

* HTTPS
* Permission request from a user gesture
* Feature detection
* Browser-specific heading normalization
* Screen orientation compensation
* Low-pass filtering
* Calibration handling
* No assumption that absolute compass heading is always reliable

Do not enable compass mode by default.

---

# 25. Rendering performance

Target:

* Preferred: 60 frames per second
* Acceptable minimum during complex transitions: 30 frames per second
* Target devices: approximately two-year-old mainstream phones
* No sustained thermal-heavy computation

## 25.1 Device quality tiers

Detect an initial quality tier using:

* Mobile versus desktop
* Device pixel ratio
* Viewport resolution
* Renderer backend
* Measured frame time during startup
* GPU limits where available

Do not rely only on user-agent strings.

## 25.2 Initial budgets

Suggested budgets:

```text
Initial compressed transfer:
  Under 8 MB

Total after optional high-resolution assets:
  Under 20 MB

Main-thread long task:
  Avoid tasks over 50 ms

Mobile DPR:
  Cap around 1.25–1.5 initially

Desktop DPR:
  Cap around 2
```

Tune after measurement.

## 25.3 Draw-call targets

Prefer:

* One star-field draw call
* Batched orbit lines
* Shared sphere geometry
* Shared materials where possible
* No real-time shadow maps
* No per-star DOM elements
* No per-orbit-segment mesh objects

## 25.4 Adaptive quality

Reduce quality in this order:

1. Atmosphere sample count
2. Device pixel ratio
3. Cloud resolution
4. Earth texture resolution
5. Star count
6. Orbit-line detail
7. Planet sphere subdivisions

Do not reduce astronomical positional accuracy.

---

# 26. Accessibility and reduced motion

The application must remain usable without device orientation.

Provide:

* Keyboard-operable slider
* Keyboard look controls or focusable directional controls
* Text labels for selected objects
* Sufficient contrast
* Reduced-motion mode
* Pause or disable camera auto-guidance
* Nonvisual current-state summary

When `prefers-reduced-motion` is enabled:

* Reduce spring overshoot
* Lower maximum angular acceleration
* Disable decorative camera banking
* Offer jump-to-landmark buttons
* Preserve continuous state without fast cinematic arcs

---

# 27. Debugging tools

Create a development-only debug panel.

Include:

* Timestamp
* Observer coordinates
* Renderer backend
* Current frame
* Render origin
* Current physical distance
* Current scale domain
* Camera speed
* Camera acceleration
* FPS
* Draw calls
* Texture memory estimate
* Selected object vectors
* Apparent versus geometric direction
* Toggle frame axes
* Toggle body centers
* Toggle bounding spheres
* Force quality tier
* Force WebGL
* Freeze simulation time

Suggested query parameters:

```text
?debug=1
?renderer=webgl
?depth=reversed
?quality=low
?time=2026-07-11T22:00:00Z
?lat=39.7684
?lon=-86.1581
```

Fixed time and location parameters are essential for reproducible screenshots.

---

# 28. Testing

## 28.1 Unit tests

Test:

* AU-to-meter conversion
* Degree/radian conversion
* Frame mappings
* EQJ-to-ecliptic transforms
* Horizontal-to-Three transform
* Geodetic observer conversion
* Logarithmic slider mapping
* Soft landmark attraction
* Camera spring stability
* Phase-name mapping
* Distance formatting
* Opening-target scoring

Every coordinate test should include frame and unit names.

## 28.2 Astronomy integration tests

For fixed times and locations, snapshot:

* Moon altitude and azimuth
* Sun altitude and azimuth
* Moon illuminated fraction
* Moon distance
* Heliocentric Earth position
* Heliocentric planet positions

Use tolerances rather than exact serialized floating-point equality.

## 28.3 Visual regression tests

Create fixed scenarios:

1. Daytime, Moon above horizon
2. Daytime, Moon below horizon
3. Twilight
4. Night with bright Moon
5. New Moon
6. Northern Hemisphere
7. Southern Hemisphere
8. Near equator
9. Whole-Earth view
10. Earth–Moon view
11. Full solar system
12. Pluto marker selected

Use fixed viewport sizes for:

* Mobile portrait
* Mobile landscape
* Desktop

## 28.4 Precision tests

The first high-risk test:

> Render the user approximately two meters above the Earth surface, then travel continuously to a whole-Earth view.

Reject the implementation if:

* The surface jitters visibly
* The horizon flickers
* The camera clips through Earth
* The atmosphere visibly pops
* The observer marker detaches
* Earth texture orientation changes discontinuously
* The Moon jumps during representation transition

## 28.5 End-to-end tests

Test:

* Slider drag
* Mouse wheel scale
* Canvas rotation
* Location permission denied
* Compass unsupported
* Compass permission denied
* WebGPU unavailable
* WebGL forced
* Moon selection
* Layer toggles
* Reduced-motion mode

---

# 29. Implementation phases

Do not attempt all features simultaneously.

## Phase 0: scaffold and contracts

Deliver:

* Vite React TypeScript project
* Strict linting and formatting
* Three renderer initialization
* WebGPU/WebGL backend reporting
* Empty scene
* State store
* Domain types
* Coordinate documentation
* Fixed-time and fixed-location debug parameters
* Test setup

Definition of done:

* App opens on mobile and desktop.
* Renderer backend is visible in debug mode.
* Unit and browser test commands run successfully.

## Phase 1: precision vertical slice

Deliver:

* Earth sphere
* Camera two meters above the surface
* Observer marker
* Basic atmosphere
* Logarithmic scale control
* Ground-to-whole-Earth transition
* Camera-relative origin
* Precision instrumentation
* Fixed location and time

Do not add planets or stars yet.

Definition of done:

* Ground-to-whole-Earth transition is visually continuous.
* No visible precision jitter on target devices.
* Horizon becomes Earth limb.
* Observer marker remains attached.
* Fast slider input remains damped.

This phase decides whether a local Earth surface representation is required.

## Phase 2: real sky

Deliver:

* Astronomy Engine integration
* Current Sun direction
* Current Moon direction
* Moon phase
* Bright planets
* Bright-star point cloud
* Opening-target selection
* Compass ribbon
* Below-horizon markers
* Optional browser location
* Optional compass mode

Definition of done:

* Fixed test cases match expected astronomical directions.
* Moon phase is produced from physical lighting and astronomy state.
* The opening camera chooses a sensible object.
* Drag remains functional on every device.

## Phase 3: Earth–Moon system

Deliver:

* Physical Moon position and true radius
* Ground proxy to physical Moon transition
* True Earth–Moon scale
* Moon marker
* Moon orbit guide
* Moon inspection inset
* Earth–Moon camera composition
* Sunlight direction guide

Definition of done:

* Moon does not visibly jump during ascent.
* Earth–Moon distance is not compressed.
* The Moon’s marker remains selectable.
* The inset phase matches the main geometry.

## Phase 4: solar system

Deliver:

* Heliocentric ecliptic frame
* Current planet positions
* True planet radii
* Planet markers
* Precomputed orbit lines
* Ecliptic plane
* Inner-system landmark
* Full-system landmark
* Pluto

Definition of done:

* Bodies occupy correct heliocentric positions.
* All markers are selectable.
* The final composition communicates the ecliptic plane.
* No object has been enlarged in the primary scene.

## Phase 5: experience and quality

Deliver:

* Earth textures
* Clouds
* Night lights
* Improved atmosphere
* Layer panel
* Earth axis and equator
* Local tangent-grid toggle
* Marker collision handling
* Reduced-motion mode
* Performance adaptation
* Asset attribution
* Loading polish
* Error handling

Definition of done:

* Target mobile devices maintain acceptable frame rate.
* Location and compass failures degrade gracefully.
* Visual overlays remain minimal by default.
* All asset licenses and credits are documented.

---

# 30. Agent operating instructions

The coding agent should follow these rules.

1. Read this specification fully before editing code.
2. Begin with Phase 0.
3. Do not add Phase 4 features while Phase 1 precision remains unresolved.
4. Keep physics and astronomy code independent of Three.js.
5. Include units and coordinate frames in names.
6. Add tests with every coordinate transform.
7. Keep celestial bodies at true physical size.
8. Use UI markers for discoverability.
9. Do not silently compress distances.
10. Do not introduce Cesium, Stellarium, Rust, Bevy, or React Three Fiber.
11. Use TSL/node materials for custom WebGPU-compatible materials.
12. Keep a forced-WebGL development path.
13. Record major decisions in `docs/adr/`.
14. Record every external asset and license in `docs/ASSETS.md`.
15. Keep the default interface sparse.
16. Avoid adding explanatory copy unless explicitly required.
17. Optimize only after measuring.
18. Do not remove the debug fixed-time and fixed-location controls.
19. Complete each phase’s definition of done before proceeding.
20. At the end of each phase, provide:

    * What was implemented
    * What remains
    * Known limitations
    * Performance measurements
    * Screenshots
    * Test results

---

# 31. First task for the coding agent

Implement Phase 0 and Phase 1 only.

The first meaningful prototype must answer one question:

> Can a browser render a stable, visually continuous journey from approximately two meters above Earth to a whole-Earth view, with an atmospheric horizon that becomes the Earth’s limb?

Do not add the Moon, planets, stars, location permission, or compass until that test succeeds.

The first prototype should include:

* A fixed observer location
* A fixed simulation timestamp
* Earth as a textured or simple shaded sphere
* Basic atmosphere
* Observer marker
* Camera-relative coordinates
* Logarithmic vertical slider
* Damped camera movement
* Soft landmarks for ground, atmosphere, low orbit, and whole Earth
* Debug readouts
* Forced WebGL mode
* Automated fixed-camera screenshots
* A short precision report

The first precision report must state:

* Renderer backend
* Device/browser tested
* Near and far clipping configuration
* Depth-buffer mode
* Maximum observed surface jitter
* Whether a local surface representation was needed
* Average and worst frame time
* Draw-call count
* Texture memory
* Known artifacts

Do not proceed to the astronomy phase until this foundation is credible.

---

# 32. Final definition of success

The first serious version is successful when a user can:

1. Open the app without a mandatory permission prompt.
2. See an accurate current sky for an approximate location.
3. Understand which direction they are facing.
4. Find the Moon, Sun, or another prominent object.
5. See below-horizon objects as clearly ghosted orientation markers.
6. Drag to look around.
7. Enable compass mode when supported.
8. Move smoothly outward using one scale control.
9. Watch the horizon turn into Earth’s limb.
10. See their starting location remain attached to Earth.
11. Reach a true-scale Earth–Moon view.
12. Select the tiny Moon and inspect its current phase.
13. Continue to the inner and full solar system.
14. See true current planetary positions and orbit guides.
15. Find Pluto.
16. Return inward without a hard scene transition.
17. Finish with a stronger intuitive sense that they are standing on the side of a planet.

