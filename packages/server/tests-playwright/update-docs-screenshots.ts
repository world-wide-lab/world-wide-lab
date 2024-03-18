import { Page, expect, test } from "@playwright/test";

import { config } from "dotenv";

config({ path: ".env.playwright" });

const docsDir = "../../docs/img/screenshots/generated/";
async function goAndTakeScreenshot(
  page: Page,
  url: string,
  additionalActions: (page: Page) => Promise<void> = async () => {},
) {
  await page.goto(`/${url}`);
  await additionalActions(page);
  await takeScreenshot(page, url);
}

async function takeScreenshot(page: Page, url: string) {
  const filename = `${url.replace(/\//g, "_")}.png`;
  await page.screenshot({ path: docsDir + filename });
}

test("Update Screenshots for docs", async ({ page }) => {
  // - Log in to World-Wide-Lab -
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

  // - Take Screenshots for documentation -
  // Home Page (wait for chart to load)
  await page.locator(".frappe-chart").waitFor();
  await page.waitForTimeout(500);
  await takeScreenshot(page, "admin");

  // List of Studies
  await goAndTakeScreenshot(page, "admin/resources/wwl_studies");

  // Create new study
  await goAndTakeScreenshot(
    page,
    "admin/resources/wwl_studies/actions/new",
    async (page) => {
      await page.locator("[name=studyId]").fill("my-awesome-study-id");
    },
  );
  await page.getByText("Save").click();

  // Detailed view
  await goAndTakeScreenshot(
    page,
    "admin/resources/wwl_studies/records/my-awesome-study-id/show",
  );

  // Data Download
  await goAndTakeScreenshot(
    page,
    "admin/resources/wwl_studies/records/my-awesome-study-id/downloadData",
  );
});
