import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative asset paths work on both the GitHub project URL and a custom domain.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
