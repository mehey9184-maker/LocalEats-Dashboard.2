import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: here,
  base: "/",
  plugins: [react(),tailwindcss()],
  build: {
    outDir:path.resolve(here,"../../dist-merchant-workshop"),
    emptyOutDir:true,
    sourcemap:false,
    minify:true,
  },
  // Never load Merchant App Firebase, Supabase or PWA plugins for this
  // separate static demonstration.
  server:{host:"127.0.0.1",port:4174,strictPort:true,hmr:false},
  preview:{host:"127.0.0.1",port:4174,strictPort:true},
});
