import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Source-level guard for the real runtime crash in the original Orders Switch.
// Does not replace future physical-device/browser UI acceptance.
const source=readFileSync(new URL("../src/components/OrdersManagement.tsx",import.meta.url),"utf8");
test("L4-R1 Orders Switch has a declared state setter and a working Kanban/list branch",()=>{
 assert.match(source,/const \[layoutMode,\s*setLayoutMode\] = useState<"kanban" \| "list">\("kanban"\)/);
 assert.match(source,/setLayoutMode\(current => current === "kanban" \? "list" : "kanban"\)/);
 assert.match(source,/viewMode === "active" && layoutMode === "kanban" \? \(/);
 assert.match(source,/layoutMode === "list" && viewMode === "active"/);
 assert.doesNotMatch(source,/Layout: \{true \?/);
 assert.doesNotMatch(source,/setLayoutMode\(true \?/);
 assert.doesNotMatch(source,/viewMode === "active" && true \? \(/);
});
