import { expect, test } from "@playwright/test";

const fixedScenario =
  "/?renderer=webgl&depth=standard&time=2026-07-11T22:00:00Z&lat=39.7684&lon=-86.1581";

const landmarks = [
  { name: "ground", sliderValue: "0", settleMs: 500 },
  { name: "atmosphere", sliderValue: "0.3", settleMs: 2_500 },
  { name: "low-orbit", sliderValue: "0.46", settleMs: 2_500 },
  { name: "whole-earth", sliderValue: "0.78", settleMs: 3_500 },
  { name: "earth-moon", sliderValue: "1", settleMs: 4_000 },
] as const;

test("captures fixed Phase 1 landmarks", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(fixedScenario);
  await expect(page.getByRole("heading", { name: "On Earth" })).toBeVisible();
  await expect(page.getByText(/Renderer: WebGL 2/)).toBeAttached();
  const slider = page.getByRole("slider", { name: "Distance from the ground" });

  for (const landmark of landmarks) {
    await slider.fill(landmark.sliderValue);
    await page.waitForTimeout(landmark.settleMs);
    await slider.blur();
    const screenshot = await page.screenshot();
    await testInfo.attach(`${testInfo.project.name}-${landmark.name}`, {
      body: screenshot,
      contentType: "image/png",
    });
  }
});
