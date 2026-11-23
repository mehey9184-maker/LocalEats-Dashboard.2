import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import {rmSync} from "node:fs";

// Rebuild the ACTUAL App.tsx + DashboardOverview + OrdersManagement entry.
// Intentionally exclude production PWA/plugin, analytics, and secret definitions.
export default defineConfig({
  plugins:[
    react(),tailwindcss(),
    {
      name:"isolated-pitch-public-sanitizer",
      // Keep original app images, fonts, and logos from /public, but NEVER
      // publish the real messaging worker or installable PWA files.
      transformIndexHtml(html:string){
        return html.replace(/<link\\s+rel="manifest"[^>]*>/g,"");
      },
      closeBundle(){
        for(const basename of [
          "firebase-messaging-sw.js","firebase-messaging-sw.html",
          "sw.js","service-worker.js","manifest.webmanifest",
          "registerSW.js","workbox-*.js",
        ]){
          if(basename.includes("*"))continue;
          rmSync(path.resolve("dist-merchant-pitch",basename),{force:true});
        }
      },
    },
  ],
  build:{outDir:"dist-merchant-pitch",emptyOutDir:true,sourcemap:false,chunkSizeWarningLimit:1500},
  resolve:{
    alias:[
      // No production Firebase project identifiers or API configurations in
      // this standalone fictional build.
      {find:"../../firebase-applet-config.json",replacement:path.resolve("preview/merchant-pitch/firebase-demo-config.json")},
      {find:"@",replacement:path.resolve(".")},
    ],
    dedupe:["react","react-dom"],
  },
});
