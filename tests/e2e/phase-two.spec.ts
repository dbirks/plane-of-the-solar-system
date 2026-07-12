import { expect, test } from "@playwright/test";

// Fixed night scenario over Indianapolis: Moon up (alt ≈ 22°, az ≈ 195.6°),
// Sun well below the horizon (az ≈ 311°), verified against astronomy-engine
// and an independent Meeus reference in unit tests.
const moonScenario =
  "/?debug=1&renderer=webgl&depth=standard&time=2026-07-24T02:30:00Z&lat=39.7684&lon=-86.1581";

function debugValue(page: import("@playwright/test").Page, label: string) {
  return page
    .getByRole("complementary", { name: "Renderer debug information" })
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

test("opening camera faces the Moon chosen by the deterministic scoring", async ({ page }) => {
  await page.goto(moonScenario);
  await expect(debugValue(page, "Opening target")).toHaveText("Moon");
  await expect
    .poll(async () => Number.parseFloat((await debugValue(page, "Heading").textContent()) ?? ""))
    .toBeGreaterThan(190);
  await expect
    .poll(async () => Number.parseFloat((await debugValue(page, "Heading").textContent()) ?? ""))
    .toBeLessThan(201);
  await expect(page.getByRole("button", { name: /Facing the Moon/ })).toBeVisible();
});

test("astronomy readouts match the fixed scenario", async ({ page }) => {
  await page.goto(moonScenario);
  await expect(debugValue(page, "Observer")).toHaveText("39.7684, -86.1581");
  // The simulation clock runs at rate 1, so trailing decimals drift slightly.
  await expect(debugValue(page, "Moon")).toContainText(/alt 22\.[34]\d°/);
  await expect(debugValue(page, "Moon")).toContainText(/az 195\.[56]\d°/);
  await expect(debugValue(page, "Sun")).toContainText(/az 311\.[78]\d°/);
  await expect(debugValue(page, "Catalog stars")).toHaveText("2865");
});

test("sky markers exist for all bright bodies and ghost below the horizon", async ({ page }) => {
  await page.goto(moonScenario);
  const markers = page.locator(".sky-marker");
  await expect(markers).toHaveCount(7);
  const moon = page.locator(".sky-marker[data-body=moon]");
  await expect(moon).not.toHaveClass(/sky-marker--ghost/);
  await expect(moon).toHaveAccessibleName(/22 degrees above the horizon/);
  const sun = page.locator(".sky-marker[data-body=sun]");
  await expect(sun).toHaveClass(/sky-marker--ghost/);
  await expect(sun).toHaveAccessibleName(/below the horizon toward 312 degrees/);
});

test("compass strip slides when the view is dragged", async ({ page }) => {
  await page.goto(moonScenario);
  const strip = page.locator("#compass-strip");
  await expect
    .poll(async () => strip.evaluate((element) => element.style.transform))
    .toContain("translateX");
  const before = await strip.evaluate((element) => element.style.transform);

  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => strip.evaluate((element) => element.style.transform))
    .not.toBe(before);
});

test("clicking a marker eases the camera back toward the body", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto(moonScenario);
  const heading = debugValue(page, "Heading");
  await expect
    .poll(async () => Number.parseFloat((await heading.textContent()) ?? ""))
    .toBeGreaterThan(150);

  // Drag well away from the Moon.
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 420, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  // Dragging right rotates the heading up and away from the Moon's 195.6°.
  await expect
    .poll(async () => Number.parseFloat((await heading.textContent()) ?? ""))
    .toBeGreaterThan(240);

  // Markers are pointer-transparent; tap the canvas at the marker's projected
  // position, exactly as a user would.
  const moonMarker = page.locator(".sky-marker[data-body=moon]");
  const markerBox = await moonMarker.boundingBox();
  expect(markerBox).not.toBeNull();
  if (!markerBox) return;
  await page.mouse.click(markerBox.x + markerBox.width / 2, markerBox.y + 9);
  await expect
    .poll(async () => Number.parseFloat((await heading.textContent()) ?? ""), { timeout: 12_000 })
    .toBeGreaterThan(190);
  await expect
    .poll(async () => Number.parseFloat((await heading.textContent()) ?? ""), { timeout: 12_000 })
    .toBeLessThan(201);
});

test("location panel offers manual and device location without any opening prompt", async ({
  page,
}) => {
  await page.goto(moonScenario);
  await page.getByRole("button", { name: /Facing the Moon/ }).click();
  await expect(page.getByLabel("Latitude in degrees")).toHaveValue("39.7684");
  await expect(page.getByLabel("Longitude in degrees")).toHaveValue("-86.1581");
  await expect(page.getByRole("button", { name: "Use device location" })).toBeVisible();
  await expect(page.getByText(/Nothing is sent anywhere/)).toBeVisible();

  await page.getByLabel("Latitude in degrees").fill("-33.87");
  await page.getByLabel("Longitude in degrees").fill("151.21");
  await page.getByRole("button", { name: "Go here" }).click();
  await page.waitForURL(/lat=-33\.87/);
  await expect(debugValue(page, "Observer")).toHaveText("-33.8700, 151.2100");
});

test("markers fade out on the journey to whole Earth", async ({ page }) => {
  await page.goto(moonScenario);
  await page.getByRole("slider", { name: "Distance from the ground" }).fill("1");
  const layer = page.locator(".sky-marker-layer");
  await expect
    .poll(async () => layer.evaluate((element) => element.style.display), { timeout: 15_000 })
    .toBe("none");
});
