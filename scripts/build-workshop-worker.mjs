import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const input=resolve("preview/merchant-workshop");
const output=resolve("dist/workshop-worker.mjs");
const host="localeats-r1g-merchant-workshop.mehey9184.workers.dev";
const html=readFileSync(resolve(input,"index.html"),"utf8");
const css=readFileSync(resolve(input,"workshop.css"),"utf8");
const js=readFileSync(resolve(input,"workshop.js"),"utf8");
// Source-only packaging: every byte is embedded in a single Worker; no
// database, API credentials, Assets binding or external network is required.
if(/(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage)/.test(js))
  throw Error("WORKSHOP_NETWORK_OR_STORAGE_FORBIDDEN");
const compiled=`// Auto-generated from preview/merchant-workshop files. Not a Merchant/API release.
const HOST=${JSON.stringify(host)};
const ASSETS={
 "/":{body:${JSON.stringify(html)},type:"text/html; charset=utf-8"},
 "/index.html":{body:${JSON.stringify(html)},type:"text/html; charset=utf-8"},
 "/workshop.css":{body:${JSON.stringify(css)},type:"text/css; charset=utf-8"},
 "/workshop.js":{body:${JSON.stringify(js)},type:"application/javascript; charset=utf-8"}
};
const HEADERS={
 "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'none'; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; worker-src 'none'",
 "Permissions-Policy":"geolocation=(), camera=(), microphone=(), payment=(), notifications=()",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
 "X-Frame-Options":"DENY",
 "X-Robots-Tag":"noindex, nofollow, noarchive",
 "Cache-Control":"no-store",
 "Cross-Origin-Resource-Policy":"same-origin"
};
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.protocol!=="https:"||url.hostname!==HOST)
    return new Response("Not found",{status:404,headers:HEADERS});
  if(request.method!=="GET"&&request.method!=="HEAD")
    return new Response("Read-only fictional workshop",{status:405,headers:{...HEADERS,Allow:"GET, HEAD"}});
  const asset=Object.hasOwn(ASSETS,url.pathname)?ASSETS[url.pathname]:null;
  if(!asset)return new Response("Not found",{status:404,headers:HEADERS});
  return new Response(request.method==="HEAD"?null:asset.body,{
   status:200,headers:{...HEADERS,"Content-Type":asset.type}
  });
 }
};`;
mkdirSync(resolve("dist"),{recursive:true});
writeFileSync(output,compiled,"utf8");
console.log("L4_R1G_WORKSHOP_BUILD_PASS — single isolated Worker, no external API or live orders");
