import { expect, test } from "@playwright/test";
import { normalizeBasePath, withBasePath } from "@/lib/app-url";

test("@smoke anonymous UI defaults to English and remembers a switch to Chinese", async ({
  browser,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto(withBasePath("/join", basePath));

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Submit availability" })).toBeVisible();
  const nameInput = page.locator('input[name="name"]');
  const emailInput = page.locator('input[name="email"]');
  const groupCodeInput = page.locator('input[name="groupCode"]');
  await nameInput.fill("管理员");
  await emailInput.fill("candidate@example.com");
  await page.getByRole("button", { name: /中文/u }).click();

  await expect(page.getByRole("heading", { name: "提交可用时间" })).toBeVisible();
  await expect(nameInput).toHaveValue("管理员");
  await expect(emailInput).toHaveValue("candidate@example.com");
  await expect(page).not.toHaveURL(/(?:\?|&)lang=/u);

  await emailInput.fill("not-an-email");
  await groupCodeInput.fill("ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
  await page.getByRole("button", { name: "发送访问链接" }).click();
  await expect(page.getByText("请输入有效邮箱", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "提交可用时间" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await context.close();
});

test("anonymous SSR defaults to English when JavaScript is disabled", async ({
  browser,
  baseURL
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: { cookies: [], origins: [] }
  });
  const page = await context.newPage();

  await page.goto(withBasePath("/", basePath));
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Interview scheduling" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Submit availability" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("面试时间管理系统");

  await context.close();
});

test("candidate confirmation submits the candidate's final language choice", async ({ page }) => {
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const token = "A".repeat(43);
  await page.goto(withBasePath(`/candidate/auth/confirm?lang=en#${token}`, basePath));

  const localeInput = page.locator('input[name="locale"]');
  await expect(localeInput).toHaveValue("en");
  await page.getByRole("button", { name: "Switch to 中文" }).click();
  await expect(localeInput).toHaveValue("zh-CN");
  await page.getByRole("button", { name: "切换到EN" }).click();
  await expect(localeInput).toHaveValue("en");
});
