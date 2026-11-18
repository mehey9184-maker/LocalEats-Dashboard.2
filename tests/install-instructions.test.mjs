import test from "node:test";
import assert from "node:assert/strict";
import { getInstallInstructions } from "../src/services/installInstructions.ts";

test("install instructions match the browser and platform", () => {
  const chrome = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36";
  const safari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15";
  assert.match(getInstallInstructions(chrome).join(" "), /Install page as app/);
  assert.match(getInstallInstructions(chrome + " Edg/142.0.0.0").join(" "), /Apps/);
  assert.match(getInstallInstructions(chrome.replace("Windows NT 10.0", "Linux; Android 15")).join(" "), /home screen/i);
  assert.match(getInstallInstructions(safari.replace("Macintosh", "iPhone")).join(" "), /Open as Web App/);
  assert.match(getInstallInstructions(safari, 5).join(" "), /Add to Home Screen/);
  assert.match(getInstallInstructions(safari).join(" "), /Add to Dock/);
  assert.match(getInstallInstructions("iPhone WhatsApp").join(" "), /Safari/);
  assert.equal(getInstallInstructions("Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0"), null);
});
