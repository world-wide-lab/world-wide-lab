import { test, expect } from '@playwright/test';

import 'dotenv/config';

test('has basic welcome message', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText("World-Wide-Lab")).not.toBeUndefined();
});

test('has a working admin UI', async ({ page }) => {
  await page.goto('/admin');

  // Should be redirected to login page
  await expect(page).toHaveURL("/admin/login");

  // Fill out login form
  const email = page.locator('[name=email]');
  const password = page.locator('[name=password]');
  await email.fill(process.env.ADMIN_AUTH_DEFAULT_EMAIL as string);
  await password.fill(process.env.ADMIN_AUTH_DEFAULT_PASSWORD as string);
  // Submit
  await page.getByText('Log in').click();

  // Log in should have been successful
  await expect(page).toHaveURL("/admin");
  await expect(page).not.toHaveURL("/admin/login");

  // Check whether screenshot matches
  await expect(page).toHaveScreenshot();

  // Check out studies table
  await page.goto('/admin/resources/wwl_studies');
  const rows = page.locator('tr');
  // Header and one row of entries
  expect(rows).toHaveCount(2);

  // Check whether table screenshot matches
  await expect(page).toHaveScreenshot();

  // Log out
  await page.goto('/admin/logout');
  await expect(page).toHaveURL("/admin/login");
});