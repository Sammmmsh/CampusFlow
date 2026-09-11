const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const baseURL = process.env.BASE_URL || "http://localhost:3000";
(async () => {
  fs.mkdirSync("docs/screenshots", { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/${name}.png`,
      fullPage: true,
    });
  };
  await page.goto(baseURL);
  await capture("welcome");
  await page.goto(baseURL + "/ops");
  await page.getByLabel("Demo role").waitFor();
  await capture("overview");
  await page.getByRole("link", { name: "Equipment", exact: true }).click();
  await capture("equipment");
  await page.getByRole("link", { name: /^Requests/ }).click();
  await page.getByLabel("Demo role").selectOption("faculty");
  await page.getByLabel("Demo role").isEnabled();
  await page.getByRole("button", { name: /Design society showcase/ }).click();
  await capture("request-review");
  await page.getByRole("button", { name: "Close request details" }).click();
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Simulate calendar outage" }).click();
  await page.getByRole("link", { name: /^Requests/ }).click();
  await page.getByRole("button", { name: /Design society showcase/ }).click();
  await page
    .getByRole("button", { name: "Approve request", exact: true })
    .click();
  await page.getByRole("button", { name: "Close request details" }).click();
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await page.getByRole("button", { name: "Retry pending jobs" }).click();
  await page.getByText("Needs retry", { exact: true }).waitFor();
  await capture("calendar-recovery");
  await page.getByRole("button", { name: "Recover demo calendar" }).click();
  await page.getByRole("button", { name: "Retry pending jobs" }).click();
  await page.getByText("Synced", { exact: true }).waitFor();
  await capture("calendar-synced");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL + "/ops");
  await page.getByLabel("Demo role").waitFor();
  await capture("mobile");
  await browser.close();
  console.log(
    "Saved seven screenshots from the running Spring Boot-backed application.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
