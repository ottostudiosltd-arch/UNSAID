import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  css: {
    devSourcemap: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/icon-192.png",
        "icons/icon-512.png",
        "assets/mascots/*.webp",
        "assets/mascots/*.png",
        "assets/mascots/*.svg",
        "assets/decorations/*.svg",
      ],
      manifest: {
        name: "UNSAID. — Your Campus. Your Stories.",
        short_name: "UNSAID.",
        description: "Anonymous campus confessions & stories in a safe campus space.",
        theme_color: "#FDF4E4",
        background_color: "#FDF4E4",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: ".",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "unsaid-static-assets",
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
