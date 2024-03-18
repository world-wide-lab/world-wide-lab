import { expect, test } from "@playwright/test";

import { config } from "dotenv";

config({ path: ".env.playwright" });

// Remove platform name from snapshots
// see https://github.com/microsoft/playwright/issues/7575
// biome-ignore lint/correctness/noEmptyPattern: Using descruturing is forced by playwright
test.beforeEach(async ({}, testInfo) => {
  testInfo.snapshotPath = (name: string) =>
    `${testInfo.file}-snapshots/${name}`;
});

test("has basic welcome message", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("World-Wide-Lab")).not.toBeUndefined();
});

test("has a working admin UI", async ({ page }) => {
  await page.goto("/admin");

  // Should be redirected to login page
  await expect(page).toHaveURL("/admin/login");

  // Fill out login form
  const email = page.locator("[name=email]");
  const password = page.locator("[name=password]");
  await email.fill(process.env.ADMIN_AUTH_DEFAULT_EMAIL as string);
  await password.fill(process.env.ADMIN_AUTH_DEFAULT_PASSWORD as string);
  // Submit
  await page.getByText("Log in").click();

  // Log in should have been successful
  await expect(page).toHaveURL("/admin");
  await expect(page).not.toHaveURL("/admin/login");

  // Check whether screenshot matches
  // Providing a large amount of leeway here to account for differences in animation progress
  await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.3 });

  // Check out studies table
  await page.goto("/admin/resources/wwl_studies");
  const rows = page.locator("tr");
  // Header and one row of entries
  expect(rows).toHaveCount(2);

  // Check whether table screenshot matches (this one has timestamps in it)
  await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.2 });

  // Log out
  await page.goto("/admin/logout");
  await expect(page).toHaveURL("/admin/login");
});
