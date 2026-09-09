import assert from "node:assert/strict";
import { isAllowedOrigin } from "./dist/corsOrigins.js";

const merchantOrigin = "https://dashboard.localeatssa.co.za";
const superAdminOrigin = "https://super-admin.example";
const previewOrigin =
  "https://local-eats-dashboard-2-6m8-feature-mehey9184-makers-projects.vercel.app";

const baseEnvironment = {
  MERCHANT_DASHBOARD_ORIGIN: merchantOrigin,
  MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX: "local-eats-dashboard-2-6m8",
  MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX:
    "-mehey9184-makers-projects.vercel.app",
};

assert.equal(isAllowedOrigin(undefined, baseEnvironment), true);
assert.equal(isAllowedOrigin(merchantOrigin, baseEnvironment), true);
assert.equal(isAllowedOrigin(previewOrigin, baseEnvironment), true);
assert.equal(
  isAllowedOrigin(superAdminOrigin, {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: superAdminOrigin,
  }),
  true
);
assert.equal(isAllowedOrigin(superAdminOrigin, baseEnvironment), false);
assert.equal(
  isAllowedOrigin(superAdminOrigin, {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: "   ",
  }),
  false
);
assert.equal(
  isAllowedOrigin("https://different-team.vercel.app", baseEnvironment),
  false
);
assert.equal(
  isAllowedOrigin("https://super-admin.example.evil.invalid", {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: superAdminOrigin,
  }),
  false
);
assert.equal(
  isAllowedOrigin("https://evil.invalid/super-admin.example", {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: superAdminOrigin,
  }),
  false
);
assert.equal(
  isAllowedOrigin("not-an-origin", {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: "not-an-origin",
  }),
  false
);
assert.equal(
  isAllowedOrigin("https://*.example", {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: "https://*.example",
  }),
  false
);
assert.equal(
  isAllowedOrigin(`${superAdminOrigin}/`, {
    ...baseEnvironment,
    SUPER_ADMIN_ORIGIN: `${superAdminOrigin}/`,
  }),
  false
);

process.env.MERCHANT_DASHBOARD_ORIGIN = merchantOrigin;
process.env.MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX =
  baseEnvironment.MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX;
process.env.MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX =
  baseEnvironment.MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX;
process.env.SUPER_ADMIN_ORIGIN = superAdminOrigin;

const { default: app } = await import("./dist/server.js");
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

try {
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const localUrl = `http://127.0.0.1:${address.port}/api/v1/admin/shops`;

  const allowedPreflight = await fetch(localUrl, {
    method: "OPTIONS",
    headers: {
      Origin: superAdminOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });

  assert.equal(allowedPreflight.status, 204);
  assert.equal(
    allowedPreflight.headers.get("access-control-allow-origin"),
    superAdminOrigin
  );
  assert.match(
    allowedPreflight.headers.get("access-control-allow-methods") ?? "",
    /GET.*POST.*OPTIONS/
  );
  assert.match(
    allowedPreflight.headers.get("access-control-allow-headers") ?? "",
    /Content-Type.*Authorization/i
  );

  const deniedPreflight = await fetch(localUrl, {
    method: "OPTIONS",
    headers: {
      Origin: "https://unapproved-admin.example",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });

  assert.equal(
    deniedPreflight.headers.get("access-control-allow-origin"),
    null
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

console.log("CORS origin checks passed: 12/12");
console.log("Express preflight checks passed: allowed origin and denied origin");
