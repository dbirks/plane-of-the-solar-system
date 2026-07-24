import { expect, test } from "@playwright/test";

// Same fixed night scenario as phase two: Moon up over Indianapolis,
// waxing gibbous (phase ≈ 119°, 74.6% lit).
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

test("journey extends to the Earth-Moon landmark at true distance", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto(moonScenario);
  await page.getByRole("button", { name: "Earth–Moon" }).click();
  await expect(page.getByRole("slider", { name: "Distance from the ground" })).toHaveAttribute(
    "aria-valuetext",
    // Headless Chromium reports en-US, so the readout is region-detected miles.
    "Distance from Earth · 310,686 mi",
  );
  await expect
    .poll(
      async () =>
        Number.parseFloat((await debugValue(page, "Physical distance").textContent()) ?? ""),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(499_000_000);
  await expect(debugValue(page, "Domain")).toHaveText("earth-centered");
});

test("the Moon's marker remains selectable at system scale and opens the inset", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(moonScenario);
  await page.getByRole("button", { name: "Earth–Moon" }).click();
  await expect
    .poll(
      async () =>
        Number.parseFloat((await debugValue(page, "Physical distance").textContent()) ?? ""),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(499_000_000);

  const moonMarker = page.locator(".sky-marker[data-body=moon]");
  await expect(moonMarker).toBeVisible();
  await expect(moonMarker).not.toHaveClass(/sky-marker--ghost/);
  // With the ecliptic roll the Moon can sit near the bottom edge, under the
  // debug telemetry card on portrait — activate via the keyboard path.
  await moonMarker.focus();
  await page.keyboard.press("Enter");

  const inset = page.getByRole("complementary", { name: "Moon inspection" });
  await expect(inset).toBeVisible();
  // The inset derives from the same SkyState as the scene geometry.
  await expect(inset.getByTestId("moon-phase-name")).toHaveText("Waxing gibbous");
  await expect(inset.getByText(/74\.\d%/)).toBeVisible();
  await expect(inset.getByText(/\d{3},\d{3} mi/)).toBeVisible();

  await page.getByRole("button", { name: "Close Moon inspection" }).click();
  await expect(inset).not.toBeVisible();
});

test("sky-proxy markers fade at system scale while the Moon's and Sun's persist", async ({
  page,
}) => {
  test.setTimeout(75_000);
  await page.goto(moonScenario);
  await page.getByRole("button", { name: "Earth–Moon" }).click();
  const moonMarker = page.locator(".sky-marker[data-body=moon]");
  const jupiterMarker = page.locator(".sky-marker[data-body=jupiter]");
  await expect
    .poll(async () => jupiterMarker.evaluate((element) => element.style.display), {
      timeout: 20_000,
    })
    .toBe("none");
  await expect(moonMarker).toBeVisible();
  await expect(page.locator(".sky-marker[data-body=sun]")).toBeVisible();
});
