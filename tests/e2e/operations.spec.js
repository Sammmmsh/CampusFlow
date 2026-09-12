const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

async function open(page, path = "/ops") {
  await page.goto(path);
  if (path.startsWith("/ops"))
    await expect(page.getByLabel("Demo role")).toBeVisible();
}
async function role(page, value) {
  await page.getByLabel("Demo role").selectOption(value);
  await expect(page.getByLabel("Demo role")).toHaveValue(value);
  await expect(page.getByLabel("Demo role")).toBeEnabled();
}
test("a request moves through every role and preserves history", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page.getByLabel("Give your plan a name").fill("Robotics club demo");
  await page
    .getByLabel("Tell us a little about it")
    .fill("We need a projector for a student-led robotics demonstration.");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: /^Requests/ }).click();
  await role(page, "faculty");
  await page.getByRole("button", { name: /Robotics club demo/ }).click();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
    "Approved",
  );
  await page.getByRole("button", { name: "Close request details" }).click();
  await role(page, "inventory");
  await page.getByRole("button", { name: /Robotics club demo/ }).click();
  for (const [action, expected] of [
    ["Mark ready to collect", "Ready to collect"],
    ["Record collection", "Checked out"],
    ["Confirm return", "Returned"],
  ]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
      expected,
    );
  }
  await expect(
    page.getByRole("dialog").locator(".cf-mini-history > div"),
  ).toHaveCount(5);
  await page.reload();
  await page.getByRole("button", { name: /Robotics club demo/ }).click();
  await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
    "Returned",
  );
});
test("calendar outage preserves approval and recovers without duplicate jobs", async ({
  page,
}) => {
  await open(page, "/ops/integrations");
  await role(page, "faculty");
  await page.getByRole("button", { name: "Simulate calendar outage" }).click();
  await expect(
    page.getByText("Simulated outage", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /^Requests/ }).click();
  await page.getByRole("button", { name: /Design society showcase/ }).click();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
    "Approved",
  );
  await page.getByRole("button", { name: "Close request details" }).click();
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Retry pending jobs" }).click();
  await expect(page.locator(".cf-jobs")).toContainText(
    "Demo calendar is unavailable",
  );
  await page.getByRole("button", { name: "Recover demo calendar" }).click();
  await page.getByRole("button", { name: "Retry pending jobs" }).click();
  await expect(page.locator(".cf-jobs")).toContainText("Event ID:");
  await expect(page.locator(".cf-jobs > article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Retry pending jobs" }),
  ).toBeDisabled();
});
test("student controls cannot call a privileged endpoint", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const session = await fetch("/api/ops/session").then((r) => r.json());
    const data = await fetch("/api/ops/dashboard").then((r) => r.json());
    const pending = data.requests.find((r) => r.status === "pending");
    const response = await fetch(`/api/ops/requests/${pending.id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrf,
      },
      body: "{}",
    });
    return response.status;
  });
  expect(result).toBe(403);
});
test("search and category filters work", async ({ page }) => {
  await open(page, "/ops/equipment");
  await page.getByRole("button", { name: "Photography", exact: true }).click();
  await expect(page.locator(".cf-equipment-card")).toHaveCount(1);
  await expect(page.locator(".cf-equipment-card")).toContainText("Canon");
  await page.getByLabel("Search equipment").fill("does-not-exist");
  await expect(page.locator(".cf-equipment-card")).toHaveCount(0);
});
test("mobile navigation and form fit without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good ideas deserve good equipment." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Request equipment" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
for (const route of [
  "/",
  "/choose",
  "/ops",
  "/ops/requests",
  "/ops/equipment",
  "/ops/activity",
  "/ops/integrations",
]) {
  test(`accessibility scan ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, route);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
}

test("request dialogs support keyboard focus and pass accessibility checks", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const trigger = page.getByRole("button", {
    name: "New request",
    exact: true,
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  let scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("link", { name: "View all", exact: true }).click();
  await page.getByRole("button", { name: /A day on campus/ }).click();
  scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
