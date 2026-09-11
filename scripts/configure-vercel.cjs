const fs = require("node:fs");
const origin = process.argv[2];
if (!origin)
  throw new Error(
    "Usage: node scripts/configure-vercel.cjs https://YOUR_VERIFIED_SERVICE.onrender.com",
  );
const target = new URL(origin);
if (
  target.protocol !== "https:" ||
  target.username ||
  target.password ||
  target.pathname !== "/" ||
  target.search ||
  target.hash
) {
  throw new Error(
    "Supply the verified HTTPS origin of your own Java service, without a path or credentials.",
  );
}
const config = {
  framework: "create-react-app",
  installCommand: "npm ci",
  buildCommand: "npm run build",
  outputDirectory: "build",
  rewrites: [
    {
      source: "/api/ops/:path*",
      destination: `${target.origin}/api/ops/:path*`,
    },
    { source: "/((?!api/|static/).*)", destination: "/index.html" },
  ],
  headers: [
    {
      source: "/api/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};
fs.writeFileSync(
  "frontend/vercel.json",
  JSON.stringify(config, null, 2) + "\n",
);
console.log("Configured Vercel to proxy the verified Java service.");
