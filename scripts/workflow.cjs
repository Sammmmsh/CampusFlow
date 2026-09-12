const fs = require("node:fs");
const { chromium } = require("@playwright/test");
const out = "docs/social";
fs.mkdirSync(out, { recursive: true });
const ink = "#292039",
  muted = "#6b5e7a",
  purple = "#6941c6",
  line = "#d8cde8";
const escape = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2250" viewBox="0 0 1800 2250" role="img" aria-labelledby="title desc"><title id="title">CampusFlow Ops architecture and request workflow</title><desc id="desc">Students request equipment, faculty approve against inventory capacity, and inventory managers record collection and return. A Spring Boot service commits state changes, audit events and calendar jobs to a separate SQL database. Calendar deliveries can safely retry. React is deployed on Vercel; Spring Boot uses a Docker host.</desc><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="${purple}" stroke-width="1.6"/></marker></defs><rect width="1800" height="2250" fill="#f7f4fc"/><g font-family="Segoe UI,Arial,sans-serif">`,
];
const rect = (x, y, w, h, fill = "#fff", stroke = line, r = 22) =>
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`,
  );
const text = (x, y, lines, size = 25, color = ink, weight = 400) =>
  parts.push(
    `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}">${(Array.isArray(lines) ? lines : [lines]).map((s, i) => `<tspan x="${x}" dy="${i ? size * 1.42 : 0}">${escape(s)}</tspan>`).join("")}</text>`,
  );
const arrow = (d, dashed = false) =>
  parts.push(
    `<path d="${d}" fill="none" stroke="${purple}" stroke-width="3" ${dashed ? 'stroke-dasharray="9 7"' : ""} marker-end="url(#arrow)"/>`,
  );
const section = (n, label, y) => {
  rect(70, y - 31, 42, 42, purple, purple, 12);
  text(82, y, n, 22, "white", 700);
  text(130, y, label, 28, ink, 650);
};
rect(55, 50, 1690, 255, "#302048", "#302048", 30);
text(100, 109, "CAMPUSFLOW / OPERATIONS ENGINEERING", 24, "#d9c9f1", 600);
text(100, 183, "Small campus requests. Serious engineering.", 51, "white", 650);
text(
  100,
  239,
  "A complete equipment workflow with traceable decisions and recoverable integrations.",
  27,
  "#e4d9f2",
);
section("01", "PEOPLE → A CLEAR NEXT STEP", 367);
const roles = [
  ["STUDENT", "Find equipment · submit a request"],
  ["FACULTY", "Review purpose · approve or decline"],
  ["INVENTORY MANAGER", "Prepare · record collection · return"],
];
roles.forEach(([title, body], i) => {
  const x = 70 + i * 565;
  rect(x, 399, 530, 110);
  text(x + 25, 440, title, 23, purple, 700);
  text(x + 25, 478, body, 23, muted);
});
const states = [
  ["Request", "Student submits"],
  ["Approve", "Capacity checked"],
  ["Prepare", "Desk allocates"],
  ["Collect", "Stock checked"],
  ["Return", "Units released"],
];
states.forEach(([title, body], i) => {
  const x = 70 + i * 344;
  rect(x, 555, 284, 116, i === 1 ? "#eee6fc" : "#fff");
  text(x + 23, 601, title, 29, ink, 650);
  text(x + 23, 639, body, 22, muted);
  if (i < 4) arrow(`M${x + 284} 613 H${x + 330}`);
});
arrow("M556 672 V708 H584", true);
text(
  610,
  714,
  "Decline with a reason → closed · Students can cancel while pending",
  22,
  muted,
);
section("02", "APPLICATION BOUNDARIES", 790);
rect(70, 825, 440, 405);
rect(585, 825, 635, 405, "#eee6fc");
rect(1295, 825, 435, 405);
text(100, 873, "React workspace", 31, ink, 650);
text(100, 916, "Frontend / Vercel", 23, purple, 600);
text(
  100,
  968,
  [
    "Responsive, keyboard-friendly UI",
    "Search, filters and request forms",
    "Role-specific actions and history",
    "Loading, error and empty states",
  ],
  23,
  muted,
);
rect(95, 1139, 390, 58, "#f6f1fc");
text(114, 1176, "Same-origin /api/ops requests", 22, purple, 600);
text(615, 873, "Java 17 + Spring Boot", 31, ink, 650);
text(615, 916, "REST API / Docker service", 23, purple, 600);
text(
  615,
  968,
  [
    "BCrypt accounts + cookie / CSRF validation",
    "Invited roles + workspace isolation",
    "Validation + idempotent request creation",
    "Transactional workflow and SQL row locks",
  ],
  23,
  muted,
);
rect(610, 1139, 585, 58, "#fff");
text(630, 1176, "Peak-capacity sweep over booking intervals", 23, purple, 600);
text(1325, 873, "SQL persistence", 31, ink, 650);
text(1325, 916, "Neon PostgreSQL / Flyway", 23, purple, 600);
text(
  1325,
  968,
  [
    "workspaces · sessions",
    "accounts · invitations",
    "equipment · requests",
    "audit_events · calendar_jobs",
    "Foreign keys + unique constraints",
  ],
  23,
  muted,
);
rect(1320, 1139, 385, 58, "#f6f1fc");
text(1340, 1176, "H2 for local development", 22, purple, 600);
arrow("M510 1055 H580");
arrow("M1220 1055 H1290");
text(524, 1028, "HTTPS", 17, purple, 600);
text(1234, 1028, "JDBC", 17, purple, 600);
section("03", "APPROVAL SAVES FIRST. INTEGRATION FOLLOWS.", 1299);
rect(70, 1335, 1660, 185);
text(100, 1382, "ONE DATABASE TRANSACTION", 23, purple, 700);
[
  ["Reservation state", "approved"],
  ["Audit event", "who · what · when"],
  ["Outbox job", "pending delivery"],
].forEach(([a, b], i) => {
  const x = 100 + i * 537;
  rect(x, 1410, 502, 80, "#f7f3fc", line, 14);
  text(x + 18, 1443, a, 25, ink, 600);
  text(x + 18, 1475, b, 21, muted);
});
arrow("M300 1521 V1566");
const jobs = [
  {
    x: 70,
    w: 460,
    t: "Outbox worker",
    b: ["Active-window polling + manual retry", "Job row locked during dispatch"],
  },
  {
    x: 660,
    w: 460,
    t: "Calendar adapter",
    b: ["Demo outage / recovery controls", "Optional Google Calendar API"],
  },
  {
    x: 1250,
    w: 480,
    t: "Delivery recorded",
    b: ["Success → synced + event ID", "Failure → retained for retry"],
  },
];
jobs.forEach((j) => {
  rect(j.x, 1570, j.w, 163);
  text(j.x + 24, 1618, j.t, 30, ink, 650);
  text(j.x + 24, 1661, j.b, 23, muted);
});
arrow("M530 1650 H650");
arrow("M1120 1650 H1240");
arrow("M1490 1733 V1797 H300 V1735", true);
text(
  425,
  1782,
  "Same event ID on every attempt → safe retries after a lost response",
  24,
  purple,
  600,
);
section("04", "EVIDENCE YOU CAN INSPECT", 1885);
rect(70, 1921, 810, 218);
rect(920, 1921, 810, 218);
text(100, 1967, "Test the awkward paths", 29, ink, 650);
text(
  100,
  2012,
  [
    "Concurrent approvals · adjacent reservations · late returns",
    "Cross-workspace access · forged sessions · CSRF",
    "Full browser journey · mobile layout · axe checks",
  ],
  23,
  muted,
);
text(950, 1967, "Keep boundaries honest", 29, ink, 650);
text(
  950,
  2012,
  [
    "Accounts and sample workspaces stay separate.",
    "Google Calendar live mode needs separate credentials.",
    "Original academic portal / MongoDB stays separate.",
  ],
  23,
  muted,
);
text(
  70,
  2191,
  "Built around campus life. Designed to explain, test and recover.",
  27,
  ink,
  600,
);
text(
  70,
  2226,
  "React · Java · Spring Security · REST · JDBC / SQL · Flyway · PostgreSQL · Playwright",
  22,
  muted,
);
parts.push("</g></svg>");
fs.writeFileSync(`${out}/campusflow-workflow.svg`, parts.join("\n"));
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({
    viewport: { width: 1800, height: 2250 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0">${parts.join("\n")}</body></html>`,
  );
  await page.screenshot({
    path: `${out}/campusflow-workflow.png`,
    fullPage: true,
  });
  await browser.close();
  console.log("Workflow SVG and PNG generated.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
