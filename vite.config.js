import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "maryani.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
      ],
      manifest: {
        name: "Keluarga Besar Almarhum Ibu Hj Maryani",
        short_name: "Keluarga Maryani",
        description:
          "Aplikasi manajemen keuangan dan acara Keluarga Besar Hj Maryani",
        theme_color: "#ffffff",
        background_color: "#f3f4f6", // Warna latar bg-gray-100
        display: "standalone", // Memaksa tampilan full-screen layaknya aplikasi asli
        orientation: "portrait",
        icons: [
          {
            src: "/and-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/and-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/ios-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/ios-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
