const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const password = require("node:crypto").randomBytes(24).toString("base64url");
const email = () =>
  `test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

test("account owner invites a student, enforces role and restores saved bookings after login", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const ownerEmail = email(),
    memberEmail = email();
  await page.goto("/ops/sign-in");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Full name").fill("Campus Owner");
  await page.getByLabel("Email address").fill(ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page.getByLabel("Workspace role")).toHaveValue("faculty");
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "cf_ops",
  );
  expect(Boolean(sessionCookie?.httpOnly)).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  if (page.url().startsWith("https:"))
    expect(Boolean(sessionCookie?.secure)).toBe(true);
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByLabel("Teammate email").fill(memberEmail);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const codeField = page.getByLabel("Share this invitation code");
  await expect(codeField).toBeVisible();
  const code = await codeField.inputValue();
  await page.getByRole("button", { name: "Close account settings" }).click();
  const context = await browser.newContext();
  try {
    const student = await context.newPage();
    await student.goto(new URL("/ops/sign-in", page.url()).toString());
    await student
      .getByRole("button", { name: "Join a team", exact: true })
      .click();
    await student.getByLabel("Full name").fill("Campus Student");
    await student.getByLabel("Email address").fill(memberEmail);
    await student.getByLabel("Password", { exact: true }).fill(password);
    await student.getByLabel("Invitation code").fill(code);
    await student
      .getByRole("button", { name: "Join workspace", exact: true })
      .click();
    await expect(student.getByLabel("Workspace role")).toHaveValue("student");
    await expect(student.getByLabel("Workspace role")).toBeDisabled();
    await student
      .getByRole("button", { name: "New request", exact: true })
      .click();
    await student
      .getByLabel("Give your plan a name")
      .fill("Team account booking");
    await student
      .getByLabel("Tell us a little about it")
      .fill("Equipment for our signed-in team presentation.");
    await student
      .getByRole("button", { name: "Send request", exact: true })
      .click();
    await expect(student.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: /Team account booking/ }).click();
    await page
      .getByRole("button", { name: "Approve request", exact: true })
      .click();
    await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
      "Approved",
    );
    await page.getByRole("button", { name: "Close request details" }).click();
    await page.getByLabel("Workspace role").selectOption("inventory");
    await page.getByRole("button", { name: /Team account booking/ }).click();
    for (const [action, status] of [
      ["Mark ready to collect", "Ready to collect"],
      ["Record collection", "Checked out"],
      ["Confirm return", "Returned"],
    ]) {
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.getByRole("dialog").locator(".cf-status")).toHaveText(
        status,
      );
    }
    await student
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(student).toHaveURL(/\/ops\/sign-in$/);
    const status = await student.evaluate(
      async () => (await fetch("/api/ops/dashboard")).status,
    );
    expect(status).toBe(401);
    await student.getByLabel("Email address").fill(memberEmail);
    await student.getByLabel("Password", { exact: true }).fill(password);
    await student.getByRole("button", { name: "Sign in to workspace" }).click();
    await student.getByRole("button", { name: /Team account booking/ }).click();
    await expect(student.getByRole("dialog").locator(".cf-status")).toHaveText(
      "Returned",
    );
    await expect(
      student.getByRole("dialog").locator(".cf-mini-history > div"),
    ).toHaveCount(5);
  } finally {
    await context.close();
  }
});

test("account screens pass accessibility checks on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ops/sign-in");
  for (const mode of ["Sign in", "Create workspace", "Join a team"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
