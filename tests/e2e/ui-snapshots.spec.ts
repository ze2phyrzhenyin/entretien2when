import { test } from "@playwright/test";

const pages = [
  { path: "/join", name: "join" },
  { path: "/admin/login", name: "admin-login" }
];

for (const item of pages) {
  test(`screenshot ${item.path}`, async ({ page }) => {
    await page.goto(item.path);
    await page.screenshot({ path: `artifacts/ui-snapshots/${item.name}.png`, fullPage: true });
  });
}
