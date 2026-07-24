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

test("journey reaches the full solar system in the heliocentric domain", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Solar system" }).click();
  await expect(page.getByRole("slider", { name: "Distance from the ground" })).toHaveAttribute(
    "aria-valuetext",
    "Distance from Earth · 100 AU",
  );
  await expect
    .poll(
      async () =>
        Number.parseFloat((await debugValue(page, "Physical distance").textContent()) ?? ""),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(1.19e13);
  await expect(debugValue(page, "Domain")).toHaveText("heliocentric");
});

test("all ten body markers exist and Pluto is selectable at system scale", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(fixedScenario);
  // Ten sky bodies plus the synthetic Earth marker.
  await expect(page.locator(".sky-marker")).toHaveCount(11);

  await page.getByRole("button", { name: "Solar system" }).click();
  await expect
    .poll(
      async () =>
        Number.parseFloat((await debugValue(page, "Physical distance").textContent()) ?? ""),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(1.19e13);

  const pluto = page.locator(".sky-marker[data-body=pluto]");
  await expect(pluto).toBeVisible();
  // Keyboard activation: markers stay focusable even though they are
  // pointer-transparent (coordinate taps route through the canvas).
  await pluto.focus();
  await page.keyboard.press("Enter");

  const inset = page.getByRole("complementary", { name: "Pluto details" });
  await expect(inset).toBeVisible();
  // Pluto currently sits in the mid-30s AU band from both Sun and observer.
  await expect(inset.getByText(/3\d\.\d AU/).first()).toBeVisible();
  await page.getByRole("button", { name: "Close Pluto details" }).click();
  await expect(inset).not.toBeVisible();
});

test("outer-planet markers ride their orbits with the ecliptic plane visible", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(fixedScenario);
  await page.getByRole("button", { name: "Solar system" }).click();
  await expect
    .poll(
      async () =>
        Number.parseFloat((await debugValue(page, "Physical distance").textContent()) ?? ""),
      { timeout: 25_000 },
    )
    .toBeGreaterThan(1.19e13);
  for (const body of ["jupiter", "saturn", "uranus", "neptune"]) {
    await expect(page.locator(`.sky-marker[data-body=${body}]`)).toBeVisible();
  }
  // The proxy Sun hands off to the physical heliocentric Sun.
  await expect(page.locator(".sky-marker[data-body=sun]")).toBeVisible();
});
