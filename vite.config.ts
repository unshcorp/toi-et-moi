import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS === "true" ? "/toi-et-moi/" : "/",
  // Supabase's local callback allowlist supports localhost:3000 by default.
  server: { host: "0.0.0.0", port: 3000, strictPort: true },
});
