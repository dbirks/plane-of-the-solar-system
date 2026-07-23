import { expect, test } from "@playwright/test";

const fixedScenario =
  "/?debug=1&renderer=webgl&depth=standard&time=2026-07-24T02:30:00Z&lat=39.7684&lon=-86.1581";

function debugValue(page: import("@playwright/test").Page, label: string) {
  return page
    .getByRole("complementary", { name: "Renderer debug information" })
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("..")
    .locator("dd");
}

test("Earth imagery loads asynchronously without blocking the opening", async ({ page }) => {
  await page.goto(fixedScenario);
  // Opening is immediate (no permission prompt, no loading gate)…
  await expect(page.getByRole("heading", { name: "Ground" })).toBeVisible();
  // …and the NASA textures arrive afterwards (3 base + day + night + moon).
  // The horizon-glow canvas textures only upload inside their sunset/sunrise
  // windows, and this scenario sits ~85 minutes after sunset.
  await expect
    .poll(async () => (await debugValue(page, "GPU resources").textContent()) ?? "", {
      timeout: 20_000,
    })
    .toContain("6 tex");
});

test("settings dialog houses the guide toggles and documents credits", async ({ page }) => {
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();

  // Defaults stay sparse: axis and sky grid are off, guides are on.
  await expect(dialog.getByLabel("Earth axis & equator")).not.toBeChecked();
  await expect(dialog.getByLabel("Sky grid")).not.toBeChecked();
  await expect(dialog.getByLabel("Planet orbits")).toBeChecked();

  await dialog.getByLabel("Sky grid").check();
  await expect(dialog.getByLabel("Sky grid")).toBeChecked();
  await dialog.getByLabel("Marker labels").uncheck();
  await expect(dialog.getByText(/NASA Blue Marble/)).toBeVisible();

  // The X closes it, and the toggle took effect in the scene.
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".sky-marker[data-body=moon]")).toHaveClass(/sky-marker--nolabel/);
});

test("marker labels declutter when bodies crowd together", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Solar system" }).click();
  await expect(debugValue(page, "Domain")).toHaveText("heliocentric", { timeout: 25_000 });
  // The inner planets cluster near the Sun at 53 AU; some labels must yield.
  await expect
    .poll(async () => page.locator(".sky-marker--nolabel").count(), { timeout: 15_000 })
    .toBeGreaterThan(0);
});

test("settings dialog explains movement and offers compass mode where supported", async ({
  page,
}) => {
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog.getByText("How to move")).toBeVisible();
  await expect(dialog.getByText(/Drag/)).toBeVisible();
  // Headless Chromium reports DeviceOrientationEvent, so the section shows.
  // Compass mode is a switch row like the guides (round 14).
  await expect(dialog.getByRole("checkbox", { name: /Compass mode/ })).toBeAttached();
  await expect(dialog.getByText("Aim your phone at the sky")).toBeVisible();
});
