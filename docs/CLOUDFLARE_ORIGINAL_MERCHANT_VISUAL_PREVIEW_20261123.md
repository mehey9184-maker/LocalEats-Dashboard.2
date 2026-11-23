# Cloudflare original Merchant app visual preview — isolated, no live writes

Source: current Merchant `main` SHA `45eb99d93c60efc0bfafcaa866d7a17f829fab28`. **No JSX, component, icon, layout, styling or navigation files are edited by this branch.** This branch is **NOT** the approved live pickup app release; it is a noncommercial, public visual preview under a distinct *.pages.dev address.

Cloudflare Pages project uses GitHub branch `preview/cf-merchant-original-ui-readonly-20261123`, runs `npm run build` and serves `dist/`. npm uses the already-committed package-lock.json; there is no Bun lockfile.

**Safety:** Vite build env sets pickup ordering `false`; `public/_headers` enforces `connect-src 'none'`, `form-action 'none'`, denied geolocation/camera/microphone/payment/notifications, strict frame isolation and no-store. No API tokens, Firebase secret, Supabase service key or Cloudflare binding is required. Existing production domains, Cloudflare Workers and Vercel services are untouched. Login, map/GPS, catalog, shop writes, orders and push **cannot be validated in this intentionally network-blocked visual preview**. The original frontend may show an offline/empty state where backend data would normally appear.

**Hosting acceptance:** verify Pages deployment branch+SHA; external HTTP 200 from `/index.html`, JS/CSS asset HTTP 200; CSP prevents outbound fetch and CORS; 320px/390px/desktop actual React rendering; no UI redesign. Separate gated API-backed staging is needed later for real order flow.

**Cost/PR policy:** reuse one branch and an existing GitHub launch issue; do **not** merge these preview-only headers or build settings into main. No extra UI PRs needed.
