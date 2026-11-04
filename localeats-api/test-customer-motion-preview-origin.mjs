import assert from "node:assert/strict";
import { isAllowedOrigin } from "./dist/corsOrigins.js";

// Isolated API Preview must accept the stable, exact Customer Motion M1 branch
// alias, never all *.vercel.app deployments. These checks make no API requests.
const motion = "https://project-x7cvt-git-preview-cust-28374e-mehey9184-makers-projects.vercel.app";
const p7 = "https://project-x7cvt-git-repair-custo-b916f8-mehey9184-makers-projects.vercel.app";
const production = "https://www.localeatssa.co.za";
const env = {
  VERCEL_ENV: "preview",
  CUSTOMER_APP_ORIGIN: motion,
  CUSTOMER_PROFILE_STAGING_ORIGINS: p7,
};
assert.equal(isAllowedOrigin(motion,env),true);
assert.equal(isAllowedOrigin(p7,env),true);
assert.equal(isAllowedOrigin(production,env),true);
for (const bad of [
  "https://project-x7cvt-142fx1ku5-mehey9184-makers-projects.vercel.app",
  motion + ".evil.test",
  motion + "/extra",
  "http://project-x7cvt-git-preview-cust-28374e-mehey9184-makers-projects.vercel.app",
  "https://random.vercel.app",
  "null",
]) assert.equal(isAllowedOrigin(bad,env),false,bad);
assert.equal(isAllowedOrigin(motion,{...env,CUSTOMER_APP_ORIGIN:undefined}),false);
console.log("PASS: motion alias + old P7 exact origins are allowed; unrelated or forged origins denied.");
