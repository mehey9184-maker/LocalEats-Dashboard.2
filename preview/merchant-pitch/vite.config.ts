import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Rebuild the ACTUAL App.tsx + DashboardOverview + OrdersManagement entry.
// Intentionally exclude production PWA/plugin, analytics, and secret definitions.
export default defineConfig({
  plugins:[react(),tailwindcss()],
  build:{outDir:"dist-merchant-pitch",emptyOutDir:true,sourcemap:false,chunkSizeWarningLimit:1500},
  resolve:{alias:{"@":path.resolve(".")},dedupe:["react","react-dom"]},
});
