import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const app = source("src/App.tsx");
const css = source("src/index.css");
const pages = source("src/components/Pagination.tsx");
const confirm = source("src/components/ui/ConfirmModal.tsx");

test("UX1 retains original seven dashboard navigation destinations without enabling Riders or ordering", () => {
  for (const id of ["dashboard","menu","orders","riders","marketing","payments","settings"]) {
    assert.match(app, new RegExp('id: "' + id + '"'));
  }
  assert.match(app, /const primaryMobileTabIds = \["dashboard", "orders", "menu", "riders"\]/);
  assert.match(app, /pickupOrderingEnabled\(\)/);
  assert.match(app, /isMerchantPreviewSimulatorEnabled\(\)/);
  assert.doesNotMatch(app, /VITE_PICKUP_ORDERING_ENABLED\s*=\s*true/);
});

test("UX1 global buttons retain layouts but gain accessible focus and polite press behavior", () => {
  assert.match(css, /button:focus-visible, \[role="button"\]:focus-visible/);
  assert.match(css, /outline: 2px solid var\(--color-primary\)/);
  assert.match(css, /touch-action: manipulation/);
  assert.match(css, /\.le-press-feedback:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  assert.match(css, /scale: 0\.985/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition-duration: 0\.01ms !important/);
});

test("UX1 navigations have readable, accessible targets and quiet reduced-motion springs", () => {
  assert.match(app, /useReducedMotion\(\)/);
  assert.match(app, /text-\[10px\] uppercase tracking-wider font-black mt-1\.5/g);
  assert.doesNotMatch(app, /text-\[8px\] uppercase tracking-widest font-black mt-1\.5/);
  assert.match(app, /min-w-\[64px\] min-h-12/);
  assert.match(app, /aria-label="More dashboard sections"/);
  assert.match(app, /aria-expanded=\{isMobileMoreOpen\}/);
  assert.match(app, /aria-controls="localeats-mobile-more-drawer"/);
  assert.match(app, /role="dialog"\s+aria-modal="true"\s+aria-labelledby="localeats-mobile-more-title"/);
  assert.match(app, /onKeyDown=\{\(e\) => \{\s+if \(e.key === "Escape"\)/);
  assert.match(app, /previousFocus\?\.focus\(\)/);
  assert.match(app, /transition=\{reduceMotion \? \{ duration: 0 \} : \{ type: "spring"/);
  assert.match(app, /onClick=\{\(\) => setActiveTab\(item\.id\)\}/);
});

test("UX1 pagination enlarges hit targets without changing the page change contract", () => {
  assert.match(pages, /min-w-11 h-11/g);
  assert.match(pages, /w-11 h-11 rounded-xl/);
  assert.match(pages, /aria-label=\{\x60Page \$\{page\}\x60\}/);
  assert.match(pages, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(pages, /disabled=\{currentPage === 1\}/);
  assert.match(pages, /disabled=\{currentPage === totalPages\}/);
  assert.match(pages, /onPageChange\(currentPage - 1\)/);
  assert.match(pages, /onPageChange\(currentPage \+ 1\)/);
});

test("UX1 confirmation retains both actions and traps keyboard focus with Escape", () => {
  assert.match(confirm, /aria-modal="true"/);
  assert.match(confirm, /aria-labelledby=\{titleId\}/);
  assert.match(confirm, /aria-describedby=\{descriptionId\}/);
  assert.match(confirm, /cancelRef\.current\?\.focus\(\)/);
  assert.match(confirm, /previouslyFocused\?\.focus\(\)/);
  assert.match(confirm, /e\.key === "Escape"/);
  assert.match(confirm, /e\.key === "Tab"/);
  assert.match(confirm, /onClick=\{onCancel\}/);
  assert.match(confirm, /onClick=\{onConfirm\}/);
  assert.match(confirm, /min-h-11 flex-1/g);
});


test("UX1 follow-up protects safe areas, 44px nav arrows and background scroll", () => {
  assert.match(app, /aria-label="Mobile dashboard navigation"/);
  assert.match(app, /aria-label="Main dashboard navigation"/);
  assert.match(app, /w-11 h-11 rounded-full/);
  assert.match(app, /pb-\[max\(2rem,env\(safe-area-inset-bottom\)\)\]/);
  assert.match(app, /document\.body\.style\.overflow = "hidden"/);
  assert.match(app, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(app, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\)/);
});
