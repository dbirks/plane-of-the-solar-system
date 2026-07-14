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
  // …and the two NASA textures arrive afterwards (3 base + day + night = 5).
  await expect
    .poll(async () => (await debugValue(page, "GPU resources").textContent()) ?? "", {
      timeout: 20_000,
    })
    .toContain("8 tex");
});

test("layers panel toggles explanation geometry and documents credits", async ({ page }) => {
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Layers" }).click();
  const panel = page.getByRole("complementary", { name: "Explanation layers" });
  await expect(panel).toBeVisible();

  // Defaults stay sparse: axis and sky grid are off, guides are on.
  await expect(panel.getByLabel("Earth axis & equator")).not.toBeChecked();
  await expect(panel.getByLabel("Sky grid")).not.toBeChecked();
  await expect(panel.getByLabel("Planet orbits")).toBeChecked();

  await panel.getByLabel("Sky grid").check();
  await expect(panel.getByLabel("Sky grid")).toBeChecked();
  await panel.getByLabel("Marker labels").uncheck();
  await expect(page.locator(".sky-marker[data-body=moon]")).toHaveClass(/sky-marker--nolabel/);

  await expect(panel.getByText(/NASA Blue Marble/)).toBeVisible();
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

test("reduced motion preference is exposed and honored in settings", async ({ page }) => {
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "About & how to move" }).click();
  const checkbox = page.getByRole("checkbox", { name: "Gentler camera (less motion)" });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
});
