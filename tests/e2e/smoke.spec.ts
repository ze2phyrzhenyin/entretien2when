import { expect, test } from "@playwright/test";

test("@smoke join page renders", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "填写面试时间" })).toBeVisible();
  await expect(page.getByLabel("姓名")).toBeVisible();
  await expect(page.getByLabel("邮箱")).toBeVisible();
  await expect(page.getByLabel("面试组编号")).toBeVisible();
});
