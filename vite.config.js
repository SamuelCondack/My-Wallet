import { defineConfig, loadEnv } from "vite";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

function netlifyAuthProxyPlugin(projectId) {
  return {
    name: "netlify-auth-proxy",
    closeBundle() {
      const lines = [];

      if (projectId) {
        const firebaseHost = `https://${projectId}.firebaseapp.com`;
        lines.push(
          `/__/auth/*  ${firebaseHost}/__/auth/:splat  200!`,
          `/__/firebase/*  ${firebaseHost}/__/firebase/:splat  200!`
        );
      }

      lines.push("/*  /index.html  200");
      writeFileSync(resolve("public/_redirects"), `${lines.join("\n")}\n`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const projectId = env.VITE_FIREBASE_PROJECT_ID;

  return {
    plugins: [react(), netlifyAuthProxyPlugin(projectId)],
    publicDir: "static",
    build: {
      outDir: "public",
    },
  };
});
