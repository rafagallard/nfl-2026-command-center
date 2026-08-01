import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The relative base keeps production assets compatible with GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
