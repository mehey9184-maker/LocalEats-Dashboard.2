// Distinct Cloudflare Worker: serves ONLY fictitious static workshop files.
// Never bind a database, backend API, Cloudflare R2, Firebase, cache or keys.
interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
const SECURITY_HEADERS: Record<string,string> = {
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "no-store",
};
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const url=new URL(request.url);
    if(!["GET","HEAD"].includes(request.method)){
      return new Response("Read-only fictional demo",{status:405,headers:{Allow:"GET, HEAD",...SECURITY_HEADERS}});
    }
    if(url.pathname.startsWith("/api") || /(?:orders|checkout|pay|merchant|customer|rider|admin)(?:\/|$)/i.test(url.pathname)){
      return new Response("Not found",{status:404,headers:SECURITY_HEADERS});
    }
    const res=await env.ASSETS.fetch(request);
    const headers=new Headers(res.headers);
    for(const [name,value] of Object.entries(SECURITY_HEADERS))headers.set(name,value);
    // Never expose accidentally generated source maps or server internals.
    if(url.pathname.endsWith(".map")||url.pathname.startsWith("/.")){
      return new Response("Not found",{status:404,headers});
    }
    return new Response(res.body,{status:res.status,headers});
  },
};
