import { expect, test } from "@playwright/test";

const fixedScenario =
  "/?debug=1&renderer=webgl&depth=standard&time=2026-07-11T22:00:00Z&lat=39.7684&lon=-86.1581";

test("opens at ground scale without a permission prompt", async ({ page }) => {
  await page.goto(fixedScenario);
  await expect(page.getByRole("heading", { name: "On Earth" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Distance from the ground" })).toHaveAttribute(
    "aria-valuetext",
    "Altitude · 2 m",
  );
  await expect(
    page.getByRole("complementary", { name: "Renderer debug information" }).getByText("WebGL 2"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("slider reaches whole Earth and remains keyboard accessible", async ({ page }) => {
  await page.goto(fixedScenario);
  const slider = page.getByRole("slider", { name: "Distance from the ground" });
  await slider.fill("1");
  await expect(slider).toHaveAttribute("aria-valuetext", "Distance from Earth · 20,000 km");
  await expect(page.getByText("Whole Earth", { exact: true }).first()).toBeVisible();
});

test("wheel changes scale and help exposes reduced motion", async ({ page }) => {
  await page.goto(fixedScenario);
  await page.locator("canvas").hover();
  await page.mouse.wheel(0, 700);
  await expect
    .poll(async () => page.getByRole("slider").getAttribute("aria-valuetext"))
    .not.toBe("Altitude · 2 m");
  await page.getByRole("button", { name: "How to move" }).click();
  await expect(page.getByRole("checkbox", { name: "Reduce camera motion" })).toBeVisible();
});

test("canvas supports drag navigation", async ({ page }) => {
  test.setTimeout(75_000);
  await page.goto(fixedScenario);
  const canvas = page.locator("canvas");
  await expect(
    page.getByRole("complementary", { name: "Renderer debug information" }).getByText("WebGL 2"),
  ).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 30, {
    steps: 8,
  });
  await expect(canvas).toHaveClass(/is-dragging/);
  await page.mouse.up();
  await expect(canvas).not.toHaveClass(/is-dragging/);

  await page.getByRole("slider", { name: "Distance from the ground" }).fill("1");
  const orientationOffset = page
    .getByText("Orientation offset", { exact: true })
    .locator("..")
    .locator("dd");
  await expect
    .poll(async () => Number.parseFloat((await orientationOffset.textContent()) ?? "Infinity"), {
      timeout: 8_000,
    })
    .toBeLessThan(0.1);
});
