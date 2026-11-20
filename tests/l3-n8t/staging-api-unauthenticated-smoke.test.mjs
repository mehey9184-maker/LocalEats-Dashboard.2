import test from "node:test";
import assert from "node:assert/strict";

const API = "https://localeats-api-n8o-r52d-mehey9184-makers-projects.vercel.app";
const CUSTOMER = "https://localeats-customer-n8o-r52d-mehey9184-makers-projects.vercel.app";
const MERCHANT = "https://localeats-merchant-staging-r52d-mehey9184-makers-projects.vercel.app";

async function safeFetch(path, init = {}) {
  const url = API + path;
  const response = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
    headers: {...init.headers},
  });
  // Deliberately never send cookies, authorization, service keys or user data.
  // Never print response body or URL Location (may contain access tokens).
  assert.notEqual(response.status, 307,
    "Vercel deployment authentication redirect: cannot claim API-layer acceptance");
  assert.notEqual(response.status, 308,
    "Vercel deployment redirect: cannot claim API-layer acceptance");
  assert.notEqual(response.status, 401,
    path === "/health" ? "API health blocked by deployment auth" : "Unexpected early authorization challenge");
  return response;
}

test("N8O API health is available without credentials", async () => {
  const result = await safeFetch("/health");
  assert.equal(result.status, 200, `API health returned HTTP ${result.status}`);
});

for (const [name, origin] of [["Customer", CUSTOMER], ["Merchant", MERCHANT]]) {
  test(`${name} exact staging origin can make read-only CORS preflight`, async () => {
    const r = await safeFetch("/api/v1/merchant/shop", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.ok([200, 204].includes(r.status), `CORS preflight HTTP ${r.status}`);
    assert.equal(r.headers.get("access-control-allow-origin"), origin,
      "API did not approve the exact staging origin");
  });
}

test("unauthenticated Merchant shop lookup fails closed", async () => {
  const response = await fetch(API + "/api/v1/merchant/shop", {
    headers: {Origin: MERCHANT},
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 401,
    `Expected API-layer 401 on protected Merchant shop GET; got HTTP ${response.status}`);
  assert.equal(response.headers.get("access-control-allow-origin"), MERCHANT);
});

test("lookalike Merchant origin never receives CORS access", async () => {
  const lookalike = MERCHANT + ".attacker.example";
  const r = await fetch(API + "/api/v1/merchant/shop", {
    method: "OPTIONS",
    headers: {Origin: lookalike, "Access-Control-Request-Method": "GET"},
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(r.status, 403,
    `Lookalike staging origin must be denied at API; got HTTP ${r.status}`);
  assert.notEqual(r.headers.get("access-control-allow-origin"), lookalike);
});
