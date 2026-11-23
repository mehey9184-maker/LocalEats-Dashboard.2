interface Env { ASSETS: Fetcher }
const HOST="localeats-merchant-dashboard-preview.mehey9184.workers.dev";
export default {
 async fetch(request:Request, env:Env):Promise<Response> {
   const url=new URL(request.url);
   if(url.hostname!==HOST || url.protocol!=="https:")return new Response("Not found",{status:404});
   if(!["GET","HEAD"].includes(request.method))return new Response("Demo only — writes disabled",{status:405});
   if(/^\/(?:api|auth|admin|graphql|functions|rest|storage|realtime)(?:\/|$)/i.test(url.pathname))
     return new Response("Demo has no backend",{status:404});
   const res=await env.ASSETS.fetch(request);
   const headers=new Headers(res.headers);
   // This is the safety boundary: browser JS cannot contact production
   // Firebase, Supabase, LocalEats API, storage, push or third-party endpoints.
   headers.set("Content-Security-Policy",[
     "default-src 'none'",
     "script-src 'self'",
     "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
     "font-src 'self' https://fonts.gstatic.com",
     "img-src 'self' data:",
     "connect-src 'none'",
     "worker-src 'none'",
     "object-src 'none'",
     "frame-src 'none'",
     "frame-ancestors 'none'",
     "form-action 'none'",
     "base-uri 'none'",
     "media-src 'none'",
   ].join("; "));
   headers.set("Cache-Control","no-store");
   headers.set("Permissions-Policy","geolocation=(), camera=(), microphone=(), payment=(), notifications=()");
   headers.set("X-Content-Type-Options","nosniff");
   headers.set("X-Frame-Options","DENY");
   headers.set("Referrer-Policy","no-referrer");
   headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
   return new Response(res.body,{status:res.status,statusText:res.statusText,headers});
 }
} satisfies ExportedHandler<Env>;
