import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { configureApiCacheSafety } from "./apiCacheSafety.js";

const request = async (app: Express, headers: Record<string, string> = {}) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    return await new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }>((resolve, reject) => {
      const req = httpRequest({ host: "127.0.0.1", port, path: "/api/v1/authority", headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        }));
      });
      req.on("error", reject);
      req.end();
    });
  } finally {
    const closed = once(server, "close");
    server.close();
    await closed;
  }
};

const authorityRoute = (app: Express) => {
  app.get("/api/v1/authority", (_req, res) => {
    res.status(200).json({ success: true, authority: "fresh" });
  });
};

test("Express ETag handling can turn a cached JSON authority response into 304", async () => {
  const app = express();
  authorityRoute(app);

  const initial = await request(app);
  const etag = initial.headers.etag;
  assert.equal(initial.status, 200);
  assert.equal(typeof etag, "string");

  const conditional = await request(app, { "If-None-Match": etag as string });
  assert.equal(conditional.status, 304);
  assert.equal(conditional.body, "");
});

test("API cache safety returns fresh no-store JSON for conditional authority requests", async () => {
  const app = express();
  configureApiCacheSafety(app);
  authorityRoute(app);

  const response = await request(app, { "If-None-Match": '"previous-authority"' });
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers.etag, undefined);
  assert.deepEqual(JSON.parse(response.body), { success: true, authority: "fresh" });
});
