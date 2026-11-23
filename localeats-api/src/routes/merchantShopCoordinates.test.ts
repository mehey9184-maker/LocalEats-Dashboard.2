import test from "node:test";
import assert from "node:assert/strict";
import {
  createMerchantCoordinates,
  normalizeVerifiedShopCoordinates,
  resolveMerchantCoordinateMode,
} from "./merchantShopCoordinates.js";

test("legacy Production mode is the default and retains all four columns", () => {
  assert.equal(resolveMerchantCoordinateMode(undefined), "legacy-dual");
  assert.equal(resolveMerchantCoordinateMode(""), "legacy-dual");
  assert.deepEqual(
    createMerchantCoordinates(-26.08, 28.19, resolveMerchantCoordinateMode(undefined)),
    { latitude: -26.08, longitude: 28.19, lat: -26.08, lng: 28.19 },
  );
});

test("staging canonical mode has exactly the physical latitude/longitude columns", () => {
  assert.equal(resolveMerchantCoordinateMode("canonical-only"), "canonical-only");
  assert.deepEqual(
    createMerchantCoordinates(-26.08, 28.19, "canonical-only"),
    { latitude: -26.08, longitude: 28.19 },
  );
});

test("an unknown server configuration fails instead of inferring schema", () => {
  for (const mode of ["staging", "auto", "canonical", "false", "legacy_dual"]) {
    assert.throws(() => resolveMerchantCoordinateMode(mode), /MERCHANT_COORDINATE_MODE_INVALID/);
  }
});

test("reject invalid coordinates even if a caller bypasses request validation", () => {
  for (const [lat, lng] of [
    [91, 10], [-91, 10], [0, 181], [0, -181],
    [Number.NaN, 10], [0, Infinity],
  ]) {
    assert.throws(
      () => createMerchantCoordinates(lat, lng, "canonical-only"),
      /MERCHANT_COORDINATES_INVALID/,
    );
  }
});

test("staging response can supply legacy aliases from persisted canonical coordinates", () => {
  const result = normalizeVerifiedShopCoordinates({
    id: "stg-test-shop",
    latitude: -26.08,
    longitude: 28.19,
    owner_id: "fixture-owner",
    approval_status: "pending",
    is_active: false,
  });
  assert.equal(result.lat, -26.08);
  assert.equal(result.lng, 28.19);
  assert.equal(result.approval_status, "pending");
  assert.equal(result.is_active, false);
});

test("existing production lat/lng values are preserved only if they match authoritative columns", () => {
  const correct = normalizeVerifiedShopCoordinates({
    latitude: -26.08, longitude: 28.19, lat: -26.08, lng: 28.19,
  });
  assert.equal(correct.lat, -26.08);
  for (const bad of [
    { latitude: -26.08, longitude: 28.19, lat: -26.09 },
    { latitude: -26.08, longitude: 28.19, lng: 28.20 },
    { latitude: null, longitude: 28.19 },
    { latitude: -91, longitude: 28.19 },
    { latitude: -26.08, longitude: "28.19" },
  ]) {
    assert.throws(
      () => normalizeVerifiedShopCoordinates(bad),
      /MERCHANT_PERSISTED_COORDINATES_(?:UNVERIFIED|CONFLICT)/,
    );
  }
});
