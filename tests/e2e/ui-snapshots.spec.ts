import { expect, test } from "@playwright/test";

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

const adminEmail = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD;
const groupId = process.env.PLAYWRIGHT_GROUP_ID;
const groupCode = process.env.PLAYWRIGHT_GROUP_CODE;
const candidateId = process.env.PLAYWRIGHT_CANDIDATE_ID;
const submissionId = process.env.PLAYWRIGHT_SUBMISSION_ID;

test("screenshot authenticated admin pages when demo data is available", async ({ page }) => {
  test.skip(
    !adminEmail || !adminPassword || !groupId,
    "Missing admin demo screenshot environment."
  );

  await page.goto("/admin/login");
  await page.getByLabel("邮箱").fill(adminEmail!);
  await page.getByLabel("密码").fill(adminPassword!);
  await page.getByRole("button", { name: /登录/ }).click();
  await expect(page.getByRole("heading", { name: "面试组", exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/ui-snapshots/admin-dashboard.png", fullPage: true });

  const adminPages = [
    [`/admin/groups/${groupId}/settings`, "group-settings"],
    [`/admin/groups/${groupId}/slots`, "group-slots"],
    [`/admin/groups/${groupId}/candidates`, "candidate-list"],
    [`/admin/groups/${groupId}/overview`, "time-overview"],
    [`/admin/groups/${groupId}/appointments`, "appointments"],
    [`/admin/groups/${groupId}/reviews`, "review-list"]
  ] as const;

  for (const [path, name] of adminPages) {
    await page.goto(path);
    await page.screenshot({ path: `artifacts/ui-snapshots/${name}.png`, fullPage: true });
  }

  if (candidateId) {
    await page.goto(`/admin/groups/${groupId}/candidates/${candidateId}`);
    await page.screenshot({ path: "artifacts/ui-snapshots/candidate-detail.png", fullPage: true });
  }

  if (submissionId) {
    await page.goto(`/admin/groups/${groupId}/reviews/${submissionId}`);
    await page.screenshot({ path: "artifacts/ui-snapshots/review-detail.png", fullPage: true });
  }
});

test("screenshot candidate pages when demo data is available", async ({ page }) => {
  test.skip(!groupCode, "Missing candidate demo screenshot environment.");

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("张三")}&email=zhangsan@example.com`
  );
  await page.screenshot({ path: "artifacts/ui-snapshots/candidate-submitted.png", fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("张三")}&email=zhangsan@example.com&mode=modify`
  );
  await page.screenshot({
    path: "artifacts/ui-snapshots/candidate-modification.png",
    fullPage: true
  });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("王五")}&email=wangwu@example.com`
  );
  await page.screenshot({ path: "artifacts/ui-snapshots/candidate-submit.png", fullPage: true });
});
