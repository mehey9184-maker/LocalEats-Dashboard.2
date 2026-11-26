import test from "node:test";
import assert from "node:assert/strict";
import {isAllowedOrigin} from "./corsOrigins.js";
test("canonical production Customer and explicit Preview origins pass, lookalikes fail",()=>{
 const env={MERCHANT_DASHBOARD_ORIGIN:"https://dashboard.localeatssa.co.za",CUSTOMER_APP_ORIGIN:"https://customer-preview.example.test"};
 for(const origin of ["https://www.localeatssa.co.za","https://localeatssa.co.za",env.MERCHANT_DASHBOARD_ORIGIN,env.CUSTOMER_APP_ORIGIN])assert.equal(isAllowedOrigin(origin,env),true);
 for(const origin of ["http://www.localeatssa.co.za","http://localeatssa.co.za","https://www.localeatssa.co.za.evil.test","https://localeatssa.co.za.evil.test","https://www.localeatssa.co.za/path","https://localeatssa.co.za:444","https://localeatssa.co.za/path","null"])assert.equal(isAllowedOrigin(origin,env),false);
 assert.equal(isAllowedOrigin(undefined,{}),true);
 assert.equal(isAllowedOrigin("https://rider.example.test",{RIDER_APP_ORIGIN:"https://rider.example.test"}),true);
});

test("Dedicated Preview permits only configured exact non-production HTTPS browser origins",()=>{
 const e={LOCALEATS_PREVIEW_READ_ONLY:"true",CUSTOMER_APP_ORIGIN:"https://customer.fixture.invalid",MERCHANT_DASHBOARD_ORIGIN:"https://merchant.fixture.invalid",MERCHANT_DASHBOARD_PREVIEW_HOST_PREFIX:"preview-",MERCHANT_DASHBOARD_PREVIEW_HOST_SUFFIX:".fixture.invalid",SUPER_ADMIN_ORIGIN:"https://admin.fixture.invalid"};
 for(const origin of [e.CUSTOMER_APP_ORIGIN,e.MERCHANT_DASHBOARD_ORIGIN])assert.equal(isAllowedOrigin(origin,e),true);
 for(const origin of ["https://www.localeatssa.co.za","https://localeatssa.co.za","https://dashboard.localeatssa.co.za","https://preview-other.fixture.invalid",e.SUPER_ADMIN_ORIGIN,"http://customer.fixture.invalid","https://customer.fixture.invalid.evil.invalid"])assert.equal(isAllowedOrigin(origin,e),false);
 assert.equal(isAllowedOrigin("https://www.localeatssa.co.za",{...e,CUSTOMER_APP_ORIGIN:"https://www.localeatssa.co.za"}),false);
});
