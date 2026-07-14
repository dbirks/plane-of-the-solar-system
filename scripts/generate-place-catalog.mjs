#!/usr/bin/env node
/**
 * Generates src/location/place-catalog.ts from the GeoNames cities dump.
 *
 * Usage:
 *   node scripts/generate-place-catalog.mjs [path-to-cities15000.txt]
 *
 * Without an argument the script downloads cities15000.zip from GeoNames.
 * The generated file is committed so builds and runtime never need the
 * network. See docs/ASSETS.md for provenance and license (GeoNames,
 * CC BY 4.0, https://www.geonames.org/).
 *
 * Kept: cities with population >= 100,000 — enough that "Near <city>" is a
 * familiar anchor everywhere without shipping a gazetteer. Fields: name,
 * lat, lon, ISO country code, and US state code (admin1) for "City, IN"
 * style labels at home and "City, Germany" elsewhere (via Intl.DisplayNames).
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GEONAMES_URL = "https://download.geonames.org/export/dump/cities15000.zip";
const MIN_POPULATION = 100_000;

async function loadRows(argPath) {
  if (argPath) return readFileSync(argPath, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "geonames-"));
  const zipPath = join(dir, "cities15000.zip");
  const response = await fetch(GEONAMES_URL);
  if (!response.ok) throw new Error(`GeoNames download failed: ${response.status}`);
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  execFileSync("unzip", ["-o", zipPath, "-d", dir], { stdio: "ignore" });
  return readFileSync(join(dir, "cities15000.txt"), "utf8");
}

const text = await loadRows(process.argv[2]);
const places = [];
for (const line of text.split("\n")) {
  if (!line.trim()) continue;
  const fields = line.split("\t");
  // GeoNames tab layout: 1 name, 4 lat, 5 lon, 7 feature code, 8 country code,
  // 10 admin1, 14 population.
  const population = Number(fields[14]);
  if (!Number.isFinite(population) || population < MIN_POPULATION) continue;
  // Skip sections/boroughs of a larger city (PPLX: "Mitte" would beat
  // "Berlin" at Berlin's own coordinates) and abandoned/destroyed places.
  const featureCode = fields[7] ?? "";
  if (featureCode === "PPLX" || featureCode === "PPLQ" || featureCode === "PPLW") continue;
  const name = fields[1];
  const latitude = Number(fields[4]);
  const longitude = Number(fields[5]);
  const country = fields[8];
  const admin1 = country === "US" ? fields[10] : "";
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !country) continue;
  places.push({ name, latitude, longitude, country, admin1, population });
}

// Largest first so ties in distance resolve to the more familiar city.
places.sort((a, b) => b.population - a.population);

const header = `// GENERATED FILE — do not edit by hand.
// Source: GeoNames cities15000 dump (population >= ${MIN_POPULATION.toLocaleString("en-US")}),
// https://www.geonames.org/ — CC BY 4.0. Regenerate with
// scripts/generate-place-catalog.mjs. See docs/ASSETS.md.

export const PLACE_COUNT = ${places.length};
`;

const names = places.map((p) => p.name.replaceAll("|", "/")).join("|");
const regions = places.map((p) => (p.admin1 ? `${p.country}-${p.admin1}` : p.country)).join("|");
const lat = places.map((p) => p.latitude.toFixed(4)).join(",");
const lon = places.map((p) => p.longitude.toFixed(4)).join(",");

const body = `
/** City names, |-separated, aligned with the coordinate arrays. */
export const PLACE_NAMES = ${JSON.stringify(names)};

/** ISO country code, or "US-<state>" for US cities; |-separated. */
export const PLACE_REGIONS = ${JSON.stringify(regions)};

export const PLACE_LAT_DEG = new Float32Array([${lat}]);

export const PLACE_LON_DEG = new Float32Array([${lon}]);
`;

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "location",
  "place-catalog.ts",
);
writeFileSync(outPath, header + body);
console.log(`Wrote ${places.length} places to ${outPath}`);
