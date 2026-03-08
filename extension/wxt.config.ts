import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "OpenParty",
    permissions: ["storage", "activeTab"],
    host_permissions: ["http://localhost:4000/*", "https://*/*"]
  },
  vite: () => ({
    plugins: [tailwindcss()]
  })
});
