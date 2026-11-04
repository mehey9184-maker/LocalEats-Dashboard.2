import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {merchantStorefrontPreviewOnly,merchantStorefrontWritesEnabled,merchantStorefrontPreviewNotice} from "../src/services/merchantStorefrontPreviewPolicy.ts";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const app=read("src/App.tsx"),profile=read("src/components/ShopProfile.tsx"),dashboard=read("src/components/DashboardOverview.tsx");

test("Storefront Preview hard-disabled without public feature activation flags",()=>{
 assert.equal(merchantStorefrontPreviewOnly(),true);
 assert.equal(merchantStorefrontWritesEnabled(),false);
 assert.match(merchantStorefrontPreviewNotice(),/Saving shop details, changing availability, following, image uploads/);
 assert.match(app,/import \{ merchantStorefrontPreviewOnly, merchantStorefrontWritesEnabled \} from "\.\/services\/merchantStorefrontPreviewPolicy"/);
 assert.match(app,/<ShopProfile[\s\S]*?previewOnly=\{merchantStorefrontPreviewOnly\(\)\}/);
});

test("Profile renders original layout and card but form is inert, not a live storefront or checkout claim",()=>{
 assert.match(profile,/previewOnly\?: boolean/);
 assert.match(profile,/previewOnly = false/);
 assert.match(profile,/profileFormRef = useRef<HTMLFormElement>\(null\)/);
 assert.match(profile,/form\.inert = true/);
 assert.match(profile,/ref=\{profileFormRef\}/);
 assert.match(profile,/aria-disabled=\{previewOnly\}/);
 assert.match(profile,/merchantStorefrontPreviewNotice\(\)/);
 assert.match(profile,/Shop Card Preview/);
 assert.match(profile,/Recorded available/);
 assert.match(profile,/Recorded unavailable/);
 assert.match(profile,/Shop card example only\. Customer discovery and live checkout are not verified/);
 assert.match(profile,/grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8/);
 assert.match(profile,/Basic Information/);
 assert.match(profile,/Contact & Socials/);
 assert.match(profile,/Operating Hours/);
});

test("Profile save, upload, GPS and Follow handlers have immediate read-only guards",()=>{
 assert.match(profile,/const handleUpdate = async \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*if\(previewOnly\)return;/);
 assert.match(profile,/const handleUpdateLocation = \(\) => \{\s*if\(previewOnly\)return;/);
 assert.match(profile,/if\(previewOnly\)return; \/\/ No image uploads in Preview/);
 assert.match(profile,/if\(previewOnly\)return;\s*try \{\s*const \{ error \} = await supabase[\s\S]{0,100}\.from\("shop_followers"\)/);
 assert.match(profile,/onLocationSelect=\{\(lat, lng\) => \{\s*if\(previewOnly\)return;/);
 assert.match(profile,/previewOnly=\{previewOnly\}/);
 assert.match(profile,/onDetectGPS=\{previewOnly \? undefined : handleUpdateLocation\}/);
 assert.match(profile,/onAutoAlign=\{previewOnly \? undefined : \(\) => \{/);
 assert.match(profile,/disabled=\{previewOnly \|\| !!uploadingType\}/);
 assert.match(profile,/disabled=\{previewOnly \|\| isSaving \|\| isSuccess\}/);
 assert.match(profile,/Save Unavailable/);
 assert.match(profile,/Follow Unavailable/);
});

test("Dashboard can refresh locally, but cannot update a shop or its bulk availability",()=>{
 assert.match(dashboard,/previewOnly\?: boolean/);
 assert.match(dashboard,/previewOnly = false/);
 assert.match(dashboard,/disabled=\{previewOnly \|\| isStatusToggling\}/);
 assert.match(dashboard,/if \(previewOnly \|\| isStatusToggling\) return;/);
 assert.match(dashboard,/Status change unavailable/);
 assert.match(dashboard,/Bulk Status Unavailable/);
 assert.match(app,/<DashboardOverview[\s\S]*?previewOnly=\{merchantStorefrontPreviewOnly\(\)\}/);
 assert.match(app,/onEditProfile=\{\(\) => \{\s*if\(merchantStorefrontPreviewOnly\(\)\)toast\.info\(/);
});

test("Top offline banner and auth profile update cannot make Production or Preview writes",()=>{
 assert.match(app,/disabled=\{availabilityBusy \|\| merchantStorefrontPreviewOnly\(\)\}/);
 assert.match(app,/if \(merchantStorefrontPreviewOnly\(\) \|\| availabilityBusy\) return;/);
 assert.match(app,/Status Change Unavailable/);
 assert.match(app,/const handleSaveProfile = async \(data: ProfileData\) => \{\s*if\(!merchantStorefrontWritesEnabled\(\)\)return;/);
 assert.match(app,/if \(isEditingProfile && !merchantStorefrontPreviewOnly\(\)\)/);
 assert.match(app,/if\(merchantStorefrontPreviewOnly\(\)\)return \(/);
 assert.match(app,/Shop Onboarding — Preview Only/);
 assert.match(app,/New shop registration and uploads are unavailable/);
});

test("Preview does not unlock rider, payments, ordering or menu operations",()=>{
 assert.match(app,/previewOnly=\{merchantRiderPreviewOnly\(\)\}/);
 assert.match(app,/orders=\{merchantRiderPreviewOnly\(\) \? \[\] : orders\}/);
 assert.match(app,/ordersReadState=\{ordersReadState\}/);
 assert.match(app,/merchantSettingsS4ActionsEnabled\(\)/);
 assert.match(profile,/if\(previewOnly\)return;/);
});
