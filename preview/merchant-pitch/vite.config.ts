import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Rebuild the ACTUAL App.tsx + DashboardOverview + OrdersManagement entry.
// Intentionally exclude production PWA/plugin, analytics, and secret definitions.
export default defineConfig({
  plugins:[react(),tailwindcss()],
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
