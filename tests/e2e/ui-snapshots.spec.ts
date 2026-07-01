import { expect, test } from "@playwright/test";

const OUT_DIR = "artifacts/ui-snapshots/frontend-refactor-p0";

async function waitForSettledPage(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => !document.body.innerText.includes("正在加载"));
}

const pages = [
  { path: "/join", name: "join" },
  { path: "/admin/login", name: "admin-login" }
];

for (const item of pages) {
  test(`screenshot ${item.path}`, async ({ page }) => {
    await page.goto(item.path);
    await waitForSettledPage(page);
    await page.screenshot({ path: `${OUT_DIR}/${item.name}.png`, fullPage: true });
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
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/admin-dashboard.png`, fullPage: true });

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
    await waitForSettledPage(page);
    await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
  }

  if (candidateId) {
    await page.goto(`/admin/groups/${groupId}/candidates/${candidateId}`);
    await waitForSettledPage(page);
    await page.screenshot({ path: `${OUT_DIR}/candidate-detail.png`, fullPage: true });
  }

  if (submissionId) {
    await page.goto(`/admin/groups/${groupId}/reviews/${submissionId}`);
    await waitForSettledPage(page);
    await page.screenshot({ path: `${OUT_DIR}/review-detail.png`, fullPage: true });
  }
});

test("screenshot candidate pages when demo data is available", async ({ page }) => {
  test.skip(!groupCode, "Missing candidate demo screenshot environment.");

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("王五")}&email=wangwu@example.com`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/candidate-first-submit.png`, fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("李四")}&email=lisi@example.com`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/candidate-submitted.png`, fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("李四")}&email=lisi@example.com&mode=modify`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/candidate-modification.png`, fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("李四")}&email=lisi@example.com`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/candidate-pending-review.png`, fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("张三")}&email=zhangsan@example.com`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/candidate-appointment.png`, fullPage: true });
});

test("screenshot mobile candidate pages when demo data is available", async ({ page }) => {
  test.skip(!groupCode, "Missing candidate demo screenshot environment.");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/join");
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/mobile-join.png`, fullPage: true });

  await page.goto(
    `/candidate/${groupCode}?name=${encodeURIComponent("王五")}&email=wangwu@example.com`
  );
  await waitForSettledPage(page);
  await page.screenshot({ path: `${OUT_DIR}/mobile-candidate-first-submit.png`, fullPage: true });
});
