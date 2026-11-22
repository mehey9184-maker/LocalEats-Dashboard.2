import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins:[react(),tailwindcss()],
  server:{host:"127.0.0.1",port:4173,strictPort:true,hmr:false},
  preview:{host:"127.0.0.1",port:4173,strictPort:true},
  // No PWA, Firebase, Sentry, backend, API proxy or deploy in browser acceptance.
});
