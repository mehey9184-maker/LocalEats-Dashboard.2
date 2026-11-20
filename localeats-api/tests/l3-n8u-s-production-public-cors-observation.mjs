/**
 * Read-only production diagnostics. No credentials, cookies, orders or
 * account identifiers. Never print response bodies or redirect Locations.
 */
const base="https://localeats-api.vercel.app";
const urls=["/health","/api/v1/catalog/shops"];
const origins=["https://www.localeatssa.co.za","https://localeatssa.co.za"];
for(const path of urls) {
  for(const origin of origins) {
    for(const method of ["OPTIONS","GET"]) {
      try {
        const response=await fetch(base+path,{
          method,redirect:"manual",signal:AbortSignal.timeout(12000),
          headers:{Origin:origin,...(method==="OPTIONS"?{
            "Access-Control-Request-Method":"GET",
            "Access-Control-Request-Headers":"content-type"
          }:{})}
        });
        const allow=response.headers.get("access-control-allow-origin");
        console.log(JSON.stringify({path,origin,method,status:response.status,
          corsAllowed:allow===origin,corsHeaderPresent:allow!==null}));
        // Never consume or print a Production payload.
        await response.body?.cancel();
      }catch(error) {
        console.log(JSON.stringify({path,origin,method,
          outcome:"unavailable",errorType:error instanceof Error?error.name:"unknown"}));
      }
    }
  }
}
