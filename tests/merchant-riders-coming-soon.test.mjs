import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("Riders tab stays visible with a Coming Soon message", () => {
  assert.match(app, /\{ id: "riders", label: "Riders", icon: Bike \}/);
  assert.match(app, /id="riders-coming-soon-title"/);
  assert.match(app, />Coming Soon<\/h1>/);
  assert.match(app, /Rider management is not available yet/);
});

test("Riders page is a static lock screen with no interactive rider controls", () => {
  const start = app.indexOf('{activeTab === "riders" && (');
  const end = app.indexOf('{activeTab === "payments" && (', start);
  assert.ok(start >= 0 && end > start, "Riders route must remain before Payments");
  const screen = app.slice(start, end);
  assert.match(screen, /<section aria-labelledby="riders-coming-soon-title"/);
  assert.doesNotMatch(screen, /<RiderManagement\b|onClick=|onChange=|onSubmit=|<button\b|supabase|fetchConnections|requestRider|sendRiderNudge/);
  assert.doesNotMatch(app, /import \{ RiderManagement \}/);
});
