import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";

import path from "node:path";

const rootDir = path.resolve(__dirname, "..");
const executablePath = path.resolve(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  "electron",
);

test("electron app", async () => {
  const electronApp = await electron.launch({
    args: ["."],
    executablePath,
  });

  const page = await electronApp.firstWindow();

  // Check title
  await expect(page).toHaveTitle("World-Wide-Lab");

  // Check for sidebar items
  await expect(page.getByText("Studies")).not.toBeUndefined();
  await expect(page.getByText("Participants")).not.toBeUndefined();

  // Close app
  await electronApp.close();
});
