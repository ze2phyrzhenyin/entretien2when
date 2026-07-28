import { expect, test } from "@playwright/test";
import { normalizeBasePath } from "@/lib/app-url";

test.skip(
  process.env.PLAYWRIGHT_PRODUCTION_BUILD !== "1",
  "This suite is reserved for the production basePath build gate."
);

test("@base-path production build serves assets and navigation below the configured path", async ({
  page,
  request
}) => {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  expect(basePath).not.toBe("");

  const response = await request.get(`${basePath}/join`);
  expect(response.status()).toBe(200);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");

  await page.goto(basePath);
  await page.getByRole("link", { name: "提交可用时间" }).click();
  await expect(page).toHaveURL(new RegExp(`${basePath}/join$`));
  await expect(page.getByRole("heading", { name: "提交可用时间" })).toBeVisible();
  await page.goto(`${basePath}/admin/login`);
  await expect(page).toHaveURL(new RegExp(`${basePath}/admin/login$`));
  await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();

  const scriptSources = await page
    .locator("script[src]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("src")));
  expect(scriptSources.length).toBeGreaterThan(0);
  expect(scriptSources.every((source) => source?.startsWith(`${basePath}/_next/`))).toBe(true);
});
